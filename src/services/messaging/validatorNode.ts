import {ethers, Wallet} from 'ethers'
import {Inject, Service} from 'typedi'
import {Logger} from 'winston'
import {EthSig} from '../../utilz/ethSig'
import {ValidatorClient} from './validatorClient'
import {WaitNotify} from '../../utilz/waitNotify'
import {NodeInfo, ValidatorContractState} from '../messaging-common/validatorContractState'
import {ValidatorRandom} from './validatorRandom'
import {ValidatorPing} from './validatorPing'
import StrUtil from '../../utilz/strUtil'
import {FeedItem, FeedItemSig, MessageBlock, MessageBlockUtil,} from '../messaging-common/messageBlock'
import {WinstonUtil} from '../../utilz/winstonUtil'
import {RedisClient} from '../messaging-common/redisClient'
import {Coll} from '../../utilz/coll'
import DateUtil from '../../utilz/dateUtil'
import {QueueManager} from './QueueManager'
import {Check} from '../../utilz/check'
import schedule from 'node-schedule'
import {StorageContractListener, StorageContractState} from '../messaging-common/storageContractState'
import {AxiosResponse} from 'axios'
import {PromiseUtil} from '../../utilz/promiseUtil'
import SNodeClient from './snodeClient'
import {AggregatedReplyHelper, NodeHttpStatus} from './AggregatedReplyHelper'
import {SubscribersItem} from '../channelsCompositeClasses/subscribersClass'
import config from '../../config'
import ChannelsService from '../channelsService'
import {MySqlUtil} from '../../utilz/mySqlUtil'
import {EnvLoader} from "../../utilz/envLoader";
import {
  AttestBlockResult,
  AttestSignaturesRequest,
  AttestSignaturesResponse,
  Block,
  Signer,
  TransactionObj,
  TxAttestorData,
  TxValidatorData,
  Vote
} from "../../generated/push/block_pb";
import {BlockUtil} from "../messaging-common/blockUtil";
import {BitUtil} from "../../utilz/bitUtil";
import {TransactionError} from "./transactionError";
import {BlockError} from "./blockError";

// todo move read/write qurum to smart contract constants
// todo joi validate for getRecord
@Service()
export class ValidatorNode implements StorageContractListener {
  public log: Logger = WinstonUtil.newLog(ValidatorNode);

  private readonly ADD_PAYLOAD_BLOCKING_TIMEOUT = 45000
  private readonly BLOCK_SCHEDULE = EnvLoader.getPropertyOrDefault("BLOCK_SCHEDULE", '*/30 * * * * *');

  @Inject()
  private valContractState: ValidatorContractState

  @Inject()
  private storageContractState: StorageContractState

  @Inject((type) => ValidatorRandom)
  private random: ValidatorRandom

  @Inject((type) => ValidatorPing)
  private validatorPing: ValidatorPing

  @Inject()
  private redisCli: RedisClient

  @Inject()
  private queueInitializer: QueueManager

  private wallet: Wallet
  nodeId: string

  // state
  // block (cleared on every cron event)
  private currentBlock: Block;
  // total serialized length of all transactions; used as a watermark (cleared on every cron event)
  private totalTransactionBytes : number;
  // objects used to wait on block
  private blockMonitors: Map<string, WaitNotify> = new Map<string, WaitNotify>()

  private readQuorum = 2
  private writeQuorum = 2

  constructor() {
  }

  // https://github.com/typestack/typedi/issues/6
  public async postConstruct() {
    this.log.debug('postConstruct()')
    await this.redisCli.postConstruct()

    this.log.info('loading contracts')
    await this.valContractState.postConstruct()
    this.wallet = this.valContractState.wallet
    this.nodeId = this.valContractState.nodeId

    await this.storageContractState.postConstruct(false, this)
    if (EthSig.isEthZero(this.nodeId) || StrUtil.isEmpty(this.nodeId)) {
      throw new Error('invalid node id: ' + this.nodeId)
    }
    this.log.debug(`done loading eth config, using wallet %s`, this.nodeId)
    this.validatorPing.postConstruct()
    this.random.postConstruct()
    const cronJob = schedule.scheduleJob(this.BLOCK_SCHEDULE, async () => {
      try {
        await this.batchProcessBlock(true)
      } catch (e) {
        console.log(e)
      }
    })
  }

  // ------------------------------ VALIDATOR -----------------------------------------

  //@Deprecated
  public getAllNodesMap(): Map<string, NodeInfo> {
    return this.valContractState.getAllNodesMap()
  }

  public async sendTransaction(txRaw: Uint8Array, validatorTokenRequired: boolean): Promise<boolean> {
    if (this.currentBlock == null) {
      this.currentBlock = new Block();
      this.totalTransactionBytes = 0;
    }
    if (this.currentBlock.getTxobjList().length >= BlockUtil.MAX_TRANSACTIONS_PER_BLOCK) {
      // todo improve
      // as of now - we simply reject the transaction
      // it's the sender's responsibility to retry in a while
      this.log.info('block is full; tx count: %d ; limit: %d ',
        this.currentBlock.getTxobjList().length, BlockUtil.MAX_TRANSACTIONS_PER_BLOCK);
      return false;
    }
    if (this.totalTransactionBytes >= BlockUtil.MAX_TOTAL_TRANSACTION_SIZE_BYTES) {
      // todo improve
      // as of now - we simply reject the transaction
      // it's the sender's responsibility to retry in a while
      this.log.info('block is full; totalTransactionBytes: %d ; limit: %d ',
        this.totalTransactionBytes, BlockUtil.MAX_TOTAL_TRANSACTION_SIZE_BYTES);
      return false;
    }
    // check
    const tx = BlockUtil.parseTransaction(txRaw);
    this.log.debug('processing tx: %o', tx.toObject())
    if (validatorTokenRequired) {
      // check that this Validator is a valid target, according to validatorToken
      let valid = true;
      let validatorToken = BitUtil.bytesToBase64(tx.getApitoken_asU8());
      try {
        valid = this.random.checkValidatorToken(validatorToken, this.nodeId);
      } catch (e) {
        // parsing error
        let err = 'invalid apiToken for nodeId ' + this.nodeId;
        this.log.error(err, e);
        throw new TransactionError(err);
      }
      if (!valid) {
        // logical error
        let err = 'invalid apiToken for nodeId ' + this.nodeId;
        this.log.error(err);
        throw new TransactionError(err);
      }
    }
    let txCheck = await BlockUtil.checkGenericTransaction(tx);
    if(!txCheck.success) {
      throw new BlockError(txCheck.err);
    }

    let payloadCheck = BlockUtil.checkTransactionPayload(tx);
    if(!txCheck.success) {
      throw new BlockError(txCheck.err);
    }

    // append transaction
    let txObj = new TransactionObj();
    txObj.setTx(tx);
    this.currentBlock.addTxobj(txObj);
    // note: were he serialize 1 transaction to increment the total size
    this.totalTransactionBytes += tx.serializeBinary().length;
    this.log.debug(`block contains %d transacitons, totalling as %d bytes`,
      this.currentBlock.getTxobjList().length, this.totalTransactionBytes);
    return true
  }



  /**
   * This method blocks for a long amount of time,
   * until processBlock() gets executed
   */
  public async sendTransactionBlocking(txRaw: Uint8Array): Promise<string> {
      const monitor = new WaitNotify();
      let txHash = BlockUtil.hashTransactionAsHex(txRaw);
      this.blockMonitors.set(txHash, monitor)
      this.log.debug('adding monitor for transaction hash: %s', txHash)
      const success = await this.sendTransaction(txRaw, true);
      if (!success) {
        return null;
      }
      await monitor.wait(this.ADD_PAYLOAD_BLOCKING_TIMEOUT); // block until processBlock()
      return txHash;
  }

  /**
   * Grabs all accumulated transactions (at the time of the cron job)
   * Creates a block
   * Signs a block as Validator
   *
   * round1
   * Collects signatures (patches) from all Attestors
   * Checks everyhting
   *
   * round2
   * Sends total signatures to all Attestors
   * Collects their votes agains bad signatures
   *
   * round3
   * Submits votes to the Validator.sol
   *
   * Pushes the block to the public queue
   */
  public async batchProcessBlock(cronJob: boolean): Promise<Block> {
    this.log.info('batch started');
    if (this.currentBlock == null
      || this.currentBlock.getTxobjList() == null
      || this.currentBlock.getTxobjList().length == 0) {
      if (!cronJob) {
        this.log.error('block is empty')
      }
      return null;
    }
    const block = this.currentBlock;
    const blockMonitors = this.blockMonitors;
    // replace it with a new empty block
    this.currentBlock = new Block();
    this.blockMonitors = new Map<string, WaitNotify>();


    // ** populate block
    block.setTs(DateUtil.currentTimeMillis());
    const tokenObj = this.random.createAttestToken();
    this.log.debug('random token: %o', tokenObj);
    Check.isTrue(tokenObj.attestVector?.length > 0, 'attest vector is empty');
    Check.isTrue(tokenObj.attestVector[0] != null, 'attest vector is empty');
    block.setAttesttoken(BitUtil.stringToBytes(tokenObj.attestToken));
    for (let txObj of block.getTxobjList()) {
      let vote = await this.validatorVoteOnTransaction(txObj);
      txObj.setValidatordata(vote);
    }

    // ** V signs block
    // every reply has (attestation per each transaction) and (signature)
    let blockBytesToSign = block.serializeBinary();
    const ethSig = await EthSig.signBytes(this.wallet, blockBytesToSign);
    let vSign = new Signer();
    vSign.setSig(ethSig);
    block.setSignersList([vSign]);
    let blockSignedByV = block;


    // ** As perform network attestations
    Check.isTrue(blockSignedByV.getSignersList().length == 1);
    for (const txObj of blockSignedByV.getTxobjList()) {
      Check.isTrue(txObj.getAttestordataList().length == 0);
    }
    let blockSignedByVBytes = blockSignedByV.serializeBinary();
    this.log.debug('blockSignedByV: %s', BitUtil.bytesToBase16(blockSignedByVBytes));
    this.log.debug('blockSignedByV: %o', blockSignedByV.toObject());
    let blockHashForCache = BlockUtil.hashBlockAsHex(blockSignedByVBytes);
    this.log.debug('blockHashForCache: %s', blockHashForCache);
    const attestersWhichSignedBlock: string[] = [];
    for (let j = 0; j < tokenObj.attestVector.length; j++) {

      // ** A0 attests the block
      const attesterNodeId = tokenObj.attestVector[j];
      this.log.debug('requesting attestor: %s [%d / %d]', attesterNodeId, j+1, tokenObj.attestVector.length);
      const vi = this.valContractState.getValidatorNodesMap().get(attesterNodeId);
      Check.notNull(vi, `Validator url is empty for node: ${attesterNodeId}`);
      const apiClient = new ValidatorClient(vi.url);
      const [attestorReply, attestorErr] = await apiClient.v_attestBlock(blockSignedByVBytes); // todo make parallel
      if (attestorErr != null) {
        this.log.error('attestor %s failed to sign the block, reason: %s', attesterNodeId, attestorReply);
        throw new Error('failed to sign'); // todo remove
      }
      attestersWhichSignedBlock.push(attesterNodeId);
      this.log.debug('attestor %s successfully signed the block, %o',
        attesterNodeId, attestorReply != null ? attestorReply.toObject() : "");

      // ** V checks A0 attestation
      // todo extract common logic with BlockUtil.checkBlockFinalized
      // make a block copy; and fill it with the reply
      // all the attestorData + signatures come only from the single source
      // the only purpose is to check that A signed the data correctly
      let tmpBlock = Block.deserializeBinary(blockSignedByVBytes); // todo move outside of 'for'
      // tx0 -> attest0, ...
      // is restructured into
      // block.txObj[0].tx -> attest0, ...
      for (let txIndex = 0; txIndex < tmpBlock.getTxobjList().length; txIndex++) {
        let attestDataPerTx = attestorReply.getAttestordataList()[txIndex];
        tmpBlock.getTxobjList()[txIndex].setAttestordataList([attestDataPerTx]);
      }

      let aSignatureBytes = attestorReply.getSigner().getSig_asU8();
      let tmpBlockBytes = tmpBlock.serializeBinary();
      this.log.debug('recovery pub key from block with hash: %s', EthSig.ethHash(tmpBlockBytes));
      const blockAttestorNodeId = EthSig.recoverAddressFromMsg(tmpBlockBytes, aSignatureBytes);

      this.log.debug('blockAttestorNodeId %o', blockAttestorNodeId);
      const validatorInfo = this.valContractState.getValidatorNodesMap().get(blockAttestorNodeId)
      Check.notNull(validatorInfo, `Validator url is empty for node: ${blockAttestorNodeId}`)
      // todo add additional check that this was a valid attestor from the array of attestors

      let blockSignedByVA = blockSignedByV;

      // **V merges A0 attestation into the block
      for (let txIndex = 0; txIndex < tmpBlock.getTxobjList().length; txIndex++) {
        let attestDataPerTx = attestorReply.getAttestordataList()[txIndex];
        blockSignedByVA.getTxobjList()[txIndex].getAttestordataList().push(attestDataPerTx);
      }
      blockSignedByVA.getSignersList().push(attestorReply.getSigner());

      this.log.debug('block after merging attestation: %o', blockSignedByVA.toObject());
    }
    let blockSignedByVA = blockSignedByV;
    this.log.debug('block after merging attestations: %o', blockSignedByVA.toObject());
    // --------------------------------------------------------




    // todo call every A with all signatures, collect replies
    // pass blockHashForCache so that Attestor could recover the previous block data from cache

    // todo call a contract for report or slash

    // safety check: full validation ONCE again
    let validatorSet = new Set(this.valContractState.getValidatorNodesMap().keys());
    let checkResult = await BlockUtil.checkBlockFinalized(blockSignedByVA,
      validatorSet, this.valContractState.contractCli.valPerBlock);
    if (!checkResult.success) {
      new BlockError('failed to produce block; self-validation failed for constructed block');
    }

    // 2: deliver
    await this.publishFinalizedBlock(blockSignedByVA);

    // 3: unblock addPayloadToMemPoolBlocking() requests
    for (let txObj of blockSignedByVA.getTxobjList()) {
      let tx = txObj.getTx();
      let txHash = BlockUtil.hashTransactionAsHex(tx.serializeBinary());

      const objMonitor = blockMonitors.get(txHash);
      if (objMonitor) {
        this.log.debug('unblocking monitor %s', objMonitor);
        objMonitor.notifyAll();
      } else {
        this.log.debug('no monitor found for id %s', txHash);
      }
    }
    return blockSignedByVA;
  }


  public async publishFinalizedBlock(mb: Block) {
    const queue = this.queueInitializer.getQueue(QueueManager.QUEUE_MBLOCK);
    let blockBytes = mb.serializeBinary();
    let blockAsBase16 = BitUtil.bytesToBase16(blockBytes);
    const blockHashAsBase16 = BlockUtil.hashBlockAsHex(blockBytes);
    const insertResult = await queue.accept({
      object: blockAsBase16,
      object_hash: blockHashAsBase16
    });
    this.log.debug(`published message block ${blockHashAsBase16} success: ${insertResult}`)
  }

  // I approve every valid transaciton (as of now)
  private async validatorVoteOnTransaction(txObj: TransactionObj): Promise<TxValidatorData> {
    let result = new TxValidatorData();
    // no additional checks are needed - since we're checking transaction while adding to block
    result.setVote(Vote.ACCEPTED);
    return result;
  }

  // ------------------------------ ATTESTOR -----------------------------------------

  /**
   * for every transaction: check v signaturee + check conversion results
   *
   * @param blockSignedByVBytes message block as bytes
   * @returns
   */
  public async attestBlock(blockSignedByVBytes: Uint8Array): Promise<AttestBlockResult> {
    // basic checks
    const activeValidators = new Set<string>(
      this.valContractState.getActiveValidators().map((ni) => ni.nodeId)
    )
    let blockSignedByV = BlockUtil.parseBlock(blockSignedByVBytes);
    this.log.debug('attestBlock(): received blockSignedByVBytes: %s', BitUtil.bytesToBase16(blockSignedByVBytes));
    this.log.debug('attestBlock(): received blockSignedByV: %o', blockSignedByV.toObject());
    const check1 = await BlockUtil.checkBlockAsAttestor(blockSignedByV, activeValidators);
    if (!check1.success) {
      throw new BlockError(check1.err); //todo reply with error here ?
    }
    // ** check validator signature,
    // todo MOVE IT TO BlockUtil.attestBlockFully

    // todo add additional check that this was a valid attestor from the array of attestors

    // ** cache this block for next calls
    await this.cacheBlock(blockSignedByVBytes);

    // ** check attest token
    // TODO enable it!!!!!!!!!!!!!!
/*    if (
      !this.random.checkAttestToken(
        block.getAttesttoken_asB64(),
        blockValidatorNodeId,
        this.valContractState.nodeId
      )
    ) {
      this.log.error('block attest token is invalid')
      throw new BlockError('block attest token is invalid');
    }*/



    // ** vote on every transaction; put a signature;
    // fill a temp object which contains only [votes] + [sig] to reduce the network usage
    Check.isTrue(blockSignedByV.getSignersList().length == 1);
    for (const txObj of blockSignedByV.getTxobjList()) {
      Check.isTrue(txObj.getAttestordataList().length == 0);
    }
    let ar = new AttestBlockResult();
    for (let txObj of blockSignedByV.getTxobjList()) {
      let vote = await this.attestorVoteOnTransaction(txObj);
      ar.addAttestordata(vote);
      txObj.setAttestordataList([vote]); // block:  only my vote per transaction
    }
    let blockBytes = blockSignedByV.serializeBinary();
    this.log.debug('signing block with hash: %s', EthSig.ethHash(blockBytes));
    const ethSig = await EthSig.signBytes(this.wallet, blockBytes); // block: sign bytes
    let signer = new Signer();
    signer.setSig(ethSig);
    ar.setSigner(signer);

    return ar;
  }

  // I approve every valid transaciton (as of now)
  private async attestorVoteOnTransaction(txObj: TransactionObj): Promise<TxAttestorData> {
    let result = new TxAttestorData();

    let txCheck = await BlockUtil.checkGenericTransaction(txObj.getTx());
    if (!txCheck.success) {
      result.setVote(Vote.REJECTED);
      return result;
    }

    let payloadCheck = BlockUtil.checkTransactionPayload(txObj.getTx());
    if (!txCheck.success) {
      result.setVote(Vote.REJECTED);
      return result;
    }
    result.setVote(Vote.ACCEPTED);
    return result;
  }


  public static applyAttestation(mutableBlock: Block, attResult: AttestBlockResult) {
    // todo handle errors correctly if attestation is damaged
    Check.isTrue(mutableBlock.getSignersList().length >= 1, 'block should have a validator signature at least');
    Check.isTrue(mutableBlock.getTxobjList().length == attResult.getAttestordataList().length,
      'num of transaction should equal num of tx in attestation reply');
    for (let txIndex = 0; txIndex < mutableBlock.getTxobjList().length; txIndex++) {
      let attestDataPerTx = attResult.getAttestordataList()[txIndex];
      mutableBlock.getTxobjList()[txIndex].getAttestordataList().push(attestDataPerTx);
    }
    mutableBlock.getSignersList().push(attResult.getSigner());
  }

  /**
   * Saves block to redis, by its incomplete hash.
   * @returns block hash to fetch it later
   */
  public async cacheBlock(blockBytes: Uint8Array) : Promise<string> {
    let blockHashForCache = BlockUtil.hashBlockAsHex(blockBytes);
    const key = 'node' + this.nodeId + 'blockId' + blockHashForCache;
    await this.redisCli.getClient().set(key, BitUtil.bytesToBase16(blockBytes));
    await this.redisCli.getClient().expire(key, BlockUtil.MAX_BLOCK_ASSEMBLY_TIME_SECONDS);
    this.log.debug('REDIS: saving block %s -> %s', key, BitUtil.bytesToBase16(blockBytes));
    return blockHashForCache;
  }

  /**
   * loads block from redis, by its incomplete hash
   * @param blockHashForCache a hash returned by BlockUtil.hashBlockAsHex(blockBytes)
   */
  public async getCachedBlock(blockHashForCache: string): Promise<Uint8Array> {
    const key = 'node' + this.nodeId + 'blockId' + blockHashForCache;
    let hexString = await this.redisCli.getClient().get(key);
    let result = BitUtil.base16ToBytes(hexString);
    this.log.debug('REDIS: loading block %s : %s', key, result);
    return result;
  }

  /**
   * Input: delta to make the block fully signed
   * We will patch the block and push it to the queue on the attestor side
   *
   * Output: our complaints agains those who signed it badly
   *
   * @param blockSig
   */
  public async attestSignatures(blockSig: Readonly<AttestSignaturesRequest>
  ): Promise<AttestSignaturesResponse> {
    this.log.debug('attestSignatures() %s', blockSig)
    // get cached block from redis
    const key = 'node' + this.nodeId + 'blockId' + blockSig.id;
    const mbJson = await this.redisCli.getClient().get(key)
    const mb: MessageBlock = JSON.parse(mbJson)
    const result = new AttestSignaturesResult()
    // process signatures from validator
    // take them only if they are valid
    for (let i = 0; i < Math.max(mb.responses.length, blockSig.responsesSignatures.length); i++) {
      const fi = mb.responses[i]
      const fiSignatures = blockSig.responsesSignatures[i]
      const fiSignaturesVerified: FeedItemSig[] = []
      for (const fiSig of fiSignatures) {
        const validSignature = MessageBlockUtil.isValidSignature(fi, fiSig)
        // todo
        const validNode = true
        if (validNode && validSignature) {
          fiSignaturesVerified.push(fiSig)
        }
      }
      const nodeReports = await this.complainOnMinorityNodes(blockSig.id, fi, fiSignaturesVerified)
      result.reports.push(...nodeReports)
      mb.responsesSignatures.push(fiSignaturesVerified)
    }
    mb.responsesSignatures = blockSig.responsesSignatures
    await this.publishFinalizedBlock(mb)
    this.log.debug('attestSignatures() success')
    return result
  }

  isMajority(value: number, total: number): boolean {
    return value > (total * 2.0) / 3.0
  }

  /*
    todo migrate to jsonrpc/protobuf block logic
    Count nodes who accept/decline that feedItem conversion
    Find which side is the majority
    If (this node decision) matches (majority) -> produce a complaint and sign it with the node private key
   */
  public async complainOnMinorityNodes(
    blockId: string,
    fi: FeedItem,
    sigArr: FeedItemSig[]
  ): Promise<NodeReportSig[]> {
    let totalCnt = 0
    const acceptReplies = new Map<string, FeedItemSig>()
    const declineReplies = new Map<string, FeedItemSig>()
    // true = majority of the group votes 'ACCEPT'
    // false = majority of the group votes 'DECLINE'
    // null = no majority
    let groupVote: boolean = null
    let nodeVote: boolean = null

    for (const sig of sigArr) {
      if (sig == null) {
        continue
      }
      totalCnt++
      if (sig.data.vote == 'ACCEPT') {
        acceptReplies.set(sig.nodeMeta.nodeId, sig)
        if (sig.nodeMeta.nodeId == this.nodeId) {
          nodeVote = true
        }
      } else if (sig.data.vote == 'DECLINE') {
        declineReplies.set(sig.nodeMeta.nodeId, sig)
        if (sig.nodeMeta.nodeId == this.nodeId) {
          nodeVote = false
        }
      }
    }
    if (this.isMajority(acceptReplies.size, totalCnt)) {
      groupVote = true
    } else if (this.isMajority(declineReplies.size, totalCnt)) {
      groupVote = false
    }

    if (groupVote == null) {
      this.log.error('no group majority')
      return
    }
    if (nodeVote == null) {
      this.log.error('no node sig found')
      return
    }

    if (nodeVote != groupVote) {
      this.log.error('node vote differs from group vote')
      return
    }

    // we have group majority,
    // and the node vote matches the group vote
    // so now we can complain about everyone who is minority
    // (and their vote differs from the current node vote)
    const result = new Set<NodeReportSig>()
    const minorityReplies = groupVote ? declineReplies : acceptReplies
    for (const [nodeId, fiSig] of minorityReplies) {
      Check.isTrue(this.nodeId != nodeId)
      const reportData = VoteDataV.encode(new VoteDataV(blockId, nodeId))
      const reportDataSig = await EthSig.signForContract(this.wallet, reportData)
      const report: NodeReportSig = {
        nodeId: nodeId,
        nodeVote: fiSig.data.vote,
        feedItemId: fi.payload?.data?.sid,
        reportData: reportData,
        reportSig: reportDataSig
      }
      result.add(report)
    }
    // todo
    return []
  }

  // ------------------------------ STORAGE -----------------------------------------

  async handleReshard(
    currentNodeShards: Set<number> | null,
    allNodeShards: Map<string, Set<number>>
  ): Promise<void> {
  }

  // todo migrate to new storage nodes
  public async getRecord(nsName: string, nsIndex: string, dt: string, key: string): Promise<any> {
    this.log.debug(`getRecord() nsName=${nsName}, nsIndex=${nsIndex}, dt=${dt}, key=${key}`)
    // const shardId = DbService.calculateShardForNamespaceIndex(nsName, nsIndex);
    const shardId = MessageBlockUtil.calculateAffectedShard(
      nsIndex,
      this.storageContractState.shardCount
    )
    this.log.debug('shardId=%s', shardId)
    const nodeShards = await this.storageContractState.getStorageNodesForShard(shardId)
    const nodeIdList = Coll.setToArray(nodeShards)

    const promiseList: Promise<AxiosResponse>[] = []
    const client = new SNodeClient()
    for (let i = 0; i < nodeIdList.length; i++) {
      this.log.debug('query')
      const nodeId = nodeIdList[i]
      const nodeInfo = this.valContractState.getStorageNodesMap().get(nodeId)
      Check.notNull(nodeInfo)
      if (!ValidatorContractState.isEnabled(nodeInfo)) {
        continue
      }
      const nodeBaseUrl = nodeInfo.url
      if (StrUtil.isEmpty(nodeBaseUrl)) {
        this.log.error(`node: ${nodeId} has no url in the database`)
        continue
      }
      this.log.debug(`baseUrl=${nodeBaseUrl}`)
      promiseList.push(client.getRecord(nodeBaseUrl, nsName, nsIndex, dt, key))
    }
    const prList = await PromiseUtil.allSettled(promiseList)

    // handle reply
    const arh = new AggregatedReplyHelper()
    for (let i = 0; i < nodeIdList.length; i++) {
      const nodeId = nodeIdList[i]
      const pr = prList[i]
      const nodeHttpStatus = pr.isRejected() ? NodeHttpStatus.REPLY_TIMEOUT : pr.val?.status
      const replyBody = pr.val?.data
      this.log.debug(`promise: ${pr.status} nodeHttpStatus: ${nodeHttpStatus}`)
      this.log.debug(`body: ${JSON.stringify(replyBody)}`)
      arh.appendItems(nodeId, nodeHttpStatus, replyBody)
    }
    this.log.debug('internal state %o', arh)
    const ar = arh.aggregateItems(this.readQuorum)
    this.log.debug('result %o', arh)
    return ar
  }

  // todo migrate to new storage nodes
  // @Post('/ns/:nsName/nsidx/:nsIndex/month/:month/list/')
  public async listRecordsByMonth(
    nsName: string,
    nsIndex: string,
    month: string,
    firstTs: string
  ): Promise<any> {
    this.log.debug(
      `listRecordsByMonthStartFromTs() nsName=${nsName}, nsIndex=${nsIndex}, month=${month}, firstTs=${firstTs}`
    )
    const shardId = MessageBlockUtil.calculateAffectedShard(
      nsIndex,
      this.storageContractState.shardCount
    )
    this.log.debug('shardId=%s', shardId)
    const nodeShards = await this.storageContractState.getStorageNodesForShard(shardId)
    const nodeIdList = Coll.setToArray(nodeShards)

    // todo V2 cache nodeIds and nodeUrls in ram, expire once per minute
    // todo V2 handle case where n/2+1 list are sync, and rest can be async
    // todo V2 query only specific amount of nodes
    const promiseList: Promise<AxiosResponse>[] = []
    const client = new SNodeClient()
    for (let i = 0; i < nodeIdList.length; i++) {
      this.log.debug('query')
      const nodeId = nodeIdList[i]
      const nodeInfo = this.valContractState.getStorageNodesMap().get(nodeId)
      Check.notNull(nodeInfo)
      if (!ValidatorContractState.isEnabled(nodeInfo)) {
        continue
      }
      const nodeBaseUrl = nodeInfo.url
      if (StrUtil.isEmpty(nodeBaseUrl)) {
        this.log.error(`node: ${nodeId} has no url in the database`)
        continue
      }
      this.log.debug(`baseUrl=${nodeBaseUrl}`)
      promiseList.push(client.listRecordsByMonth(nodeBaseUrl, nsName, nsIndex, month, firstTs))
    }
    const prList = await PromiseUtil.allSettled(promiseList)

    // handle reply
    const arh = new AggregatedReplyHelper()
    for (let i = 0; i < nodeIdList.length; i++) {
      const nodeId = nodeIdList[i]
      const pr = prList[i]
      const nodeHttpStatus = pr.isRejected() ? NodeHttpStatus.REPLY_TIMEOUT : pr.val?.status
      const replyBody = pr.val?.data
      this.log.debug(`promise: ${pr.status} nodeHttpStatus: ${nodeHttpStatus}`)
      this.log.debug(`body: ${JSON.stringify(replyBody)}`)
      arh.appendItems(nodeId, nodeHttpStatus, replyBody)
    }
    this.log.debug('internal state')
    console.dir(arh)
    const ar = arh.aggregateItems(this.readQuorum)
    this.log.debug('result %j', ar)
    return ar
  }

  public async listSubscribers(channel: string, chainName: string): Promise<SubscribersItem[]> {
    const chainId = config.MAP_BLOCKCHAIN_STRING_TO_ID[chainName]
    const channelDbField = ChannelsService.isEthBlockchain(chainId) ? 'channel' : 'alias'
    const rows = await MySqlUtil.queryArr<{
      subscriber: string
      userSettings: string
      ts: number
    }>(
      `select subscriber, user_settings as userSettings, UNIX_TIMESTAMP(timestamp) as ts
       from subscribers
       where (${channelDbField} = ? AND is_currently_subscribed = 1)`,
      channel
    )
    // let res = await this.subscribers.getSubscribers(channel, chainId); todo decide which impl is better
    return rows
  }
}

export class NodeReportSig {
  // complaint on nodeId
  nodeId: string
  // about this feedItem conversion result
  feedItemId: string
  // about this vote
  nodeVote: string

  // abi encoded vote data for the smart contract
  reportData: string
  // signature for the abi encoded vote
  reportSig: string
}

export class VoteDataV {
  // the block where vote should be placed
  blockId: string
  // the node wallet, we do a complaint about
  targetNode: string

  constructor(blockId: string, targetNode: string) {
    this.blockId = blockId
    this.targetNode = targetNode
  }

  public static encode(vt: VoteDataV): string {
    const abi = ethers.utils.defaultAbiCoder
    return abi.encode(['uint8', 'uint128', 'address'], [1, vt.blockId, vt.targetNode])
  }
}


