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
import {FeedItem, FeedItemSig, MessageBlockUtil} from '../messaging-common/messageBlock'
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
import {MySqlUtil} from '../../utilz/mySqlUtil'
import {EnvLoader} from "../../utilz/envLoader";
import {
  AttestBlockResult, AttestorReport,
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
import {ArrayUtil} from "../../utilz/arrayUtil";

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
  private totalTransactionBytes: number;
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
        this.log.error('error %o', e);
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
    if (!txCheck.success) {
      throw new BlockError(txCheck.err);
    }

    let payloadCheck = await BlockUtil.checkTransactionPayload(tx);
    if (!payloadCheck.success) {
      throw new BlockError(payloadCheck.err);
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
    block.setAttesttoken(BitUtil.stringToBytesUtf(tokenObj.attestToken));

    // ** V signs block
    // every reply has (attestation per each transaction) and (signature)
    await BlockUtil.signBlockAsValidator(this.wallet, block);
    let blockSignedByV: Readonly<Block> = Block.deserializeBinary(block.serializeBinary());
    let blockSignedByVBytes = blockSignedByV.serializeBinary();
    let blockSignedByVHash = BlockUtil.hashBlockAsHex(blockSignedByVBytes);
    this.log.debug('blockSignedByV: %s', BitUtil.bytesToBase16(blockSignedByVBytes));
    this.log.debug('blockSignedByV: %o', blockSignedByV.toObject());
    this.log.debug('blockSignedByVHash: %s', blockSignedByVHash);
    Check.isTrue(blockSignedByV.getSignersList().length == 1, '1 sig is required');
    for (const txObj of blockSignedByV.getTxobjList()) {
      Check.isTrue(txObj.getAttestordataList().length == 0, 'no att data is required');
    }

    // ** A1-AN get patches (network attestations)
    const attestersWhichSignedBlock: string[] = [];
    const patches: AttestBlockResult[] = [];
    for (let j = 0; j < tokenObj.attestVector.length; j++) {
      // ** A0 attests the block
      const attesterNodeId = tokenObj.attestVector[j];
      this.log.debug('requesting attestor: %s [%d / %d]', attesterNodeId, j + 1, tokenObj.attestVector.length);
      const vi = this.valContractState.getValidatorNodesMap().get(attesterNodeId);
      Check.notNull(vi, `Validator url is empty for node: ${attesterNodeId}`);
      const apiClient = new ValidatorClient(vi.url);
      const [patch, attestorErr] = await apiClient.v_attestBlock(blockSignedByVBytes); // todo make parallel
      if (attestorErr != null) {
        this.log.error('attestor %s failed to attest the block, reason: %s', attesterNodeId, patch);
        throw new Error('failed to sign'); // todo remove
      }
      attestersWhichSignedBlock.push(attesterNodeId);
      this.log.debug('attestor %s successfully signed the block, %o',
        attesterNodeId, patch != null ? patch.toObject() : "");
      // ** V checks A0 attestation
      let nodeAddress = await BlockUtil.recoverPatchAddress(this.wallet, blockSignedByV, patch);
      const validatorInfo = this.valContractState.getValidatorNodesMap().get(nodeAddress)
      Check.notNull(validatorInfo, `Validator url is empty for node: ${nodeAddress}`)
      await BlockUtil.appendPatchAsValidator(this.wallet, block, patch);
      patches.push(patch);
    }
    let blockSignedByVA = block;
    let blockSignedByVAHash = BlockUtil.hashBlockAsHex(blockSignedByVA.serializeBinary());
    this.log.debug('finalized block: %o', blockSignedByVA.toObject());
    this.log.debug('finalized block hash: %s', blockSignedByVAHash);

    // ** A1-AN send all patches

    let asr = new AttestSignaturesRequest();
    asr.setInitialblockhash(BitUtil.base16ToBytes(blockSignedByVHash));
    asr.setFinalblockhash(BitUtil.base16ToBytes(blockSignedByVAHash));
    asr.setAttestationsList(patches);
    this.log.debug('sending patches %o', asr.toObject());
    this.log.debug('Initialblockhash %s', BitUtil.bytesToBase16(asr.getInitialblockhash_asU8()));
    this.log.debug('Finalblockhash %s', BitUtil.bytesToBase16(asr.getFinalblockhash_asU8()));
    for (let j = 0; j < tokenObj.attestVector.length; j++) {
      // ** A0 attests the block
      const attestorNodeId = tokenObj.attestVector[j];
      this.log.debug('requesting attestor: %s [%d / %d]', attestorNodeId, j + 1, tokenObj.attestVector.length);
      const vi = this.valContractState.getValidatorNodesMap().get(attestorNodeId);
      Check.notNull(vi, `Validator url is empty for node: ${attestorNodeId}`);
      const apiClient = new ValidatorClient(vi.url);
      apiClient.v_attestSignatures(asr).then(value => {
        const [resp, attestorErr] = value;
        if (attestorErr != null) {
          this.log.error('attestor %s failed to attest signatures, reason: %s resp: %s', attestorNodeId, attestorErr, resp);
          throw new Error('failed to attest signatures'); // todo remove
        }
      });
    }
    // ** report
    // todo if(isValid(resp) && numReports > contract.threshold) { report to validator.sol }

    // ** safety check: full validation ONCE again
    let validatorSet = new Set(this.valContractState.getValidatorNodesMap().keys());
    let checkResult = await BlockUtil.checkBlockFinalized(blockSignedByVA,
      validatorSet, this.valContractState.contractCli.valPerBlock);
    if (!checkResult.success) {
      throw new BlockError('failed to produce block; self-validation failed for constructed block:' + checkResult.err);
    }

    // ** deliver
    await this.publishFinalizedBlock(blockSignedByVA);

    // ** unblock addPayloadToMemPoolBlocking() requests
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
    let hash1 = await this.cacheBlock(blockSignedByVBytes);

    // ** vote on every transaction; put a signature;
    // fill a temp object which contains only [votes] + [sig] to reduce the network usage
    Check.isTrue(blockSignedByV.getSignersList().length == 1, '1 signer');
    for (const txObj of blockSignedByV.getTxobjList()) {
      Check.isTrue(txObj.getAttestordataList().length == 0, '0 attestations');
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

  /**
   * Saves block to redis, by its incomplete hash.
   * @returns block hash to fetch it later
   */
  public async cacheBlock(blockBytes: Uint8Array): Promise<string> {
    let blockHashForCache = BlockUtil.hashBlockAsHex(blockBytes);
    const key = 'node-' + this.nodeId + '-blockHash-' + blockHashForCache;
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
    const key = 'node-' + this.nodeId + '-blockHash-' + blockHashForCache;
    let hexString = await this.redisCli.getClient().get(key);
    Check.notNull(hexString, 'cached block is missing, key: ' + key);
    let result = BitUtil.base16ToBytes(hexString);
    this.log.debug('REDIS: loading block %s : %s', key, hexString);
    return result;
  }

  /**
   * Input: delta to make the block fully signed
   * We will patch the block and push it to the queue on the attestor side
   *
   * Output: our complaints agains those who signed it badly
   *
   * @param asr
   */
  public async attestSignatures(asr: Readonly<AttestSignaturesRequest>): Promise<AttestSignaturesResponse> {
    this.log.debug('attestSignatures() started');
    this.log.debug('applying patches %o', asr.toObject());
    this.log.debug('Initialblockhash %s', BitUtil.bytesToBase16(asr.getInitialblockhash_asU8()));
    this.log.debug('Finalblockhash %s', BitUtil.bytesToBase16(asr.getFinalblockhash_asU8()));

    // ** get cached block from redis
    const key = BitUtil.bytesToBase16(asr.getInitialblockhash_asU8());
    const blockSignedByVBytes = await this.getCachedBlock(key);
    this.log.debug('blockSignedByVBytes %s', BitUtil.bytesToBase16(blockSignedByVBytes));

    const expectedInitialBlockHash = BitUtil.bytesToBase16(asr.getInitialblockhash_asU8());
    const initialBlockHash = BlockUtil.hashBlockAsHex(blockSignedByVBytes);
    if (initialBlockHash !== expectedInitialBlockHash) {
      this.log.error('expected %s , got %s', expectedInitialBlockHash, initialBlockHash);
      throw new BlockError('intial block hash does not match the expected hash');
    }
    this.log.debug('cashed block matches with hash');

    Check.isTrue(ArrayUtil.hasMinSize(blockSignedByVBytes, 10), 'cached block is invalid (size)');
    const blockSignedByV = Block.deserializeBinary(blockSignedByVBytes);
    const blockSignedByVA = Block.deserializeBinary(blockSignedByVBytes);

    // ** re-create block ; it should be bit-to-bit exact as on the validator side!!!
    // process signatures from validator
    // take them only if they are valid
    let gotOwnSignature = false;
    let vNodeId;
    for (let sigIndex = 0; sigIndex < asr.getAttestationsList().length; sigIndex++) {
      let patch = asr.getAttestationsList()[sigIndex];
      let nodeId = await BlockUtil.recoverPatchAddress(this.wallet, blockSignedByV, patch);
      const isValidatorSignature = sigIndex == 0;
      if (isValidatorSignature) {
        vNodeId = nodeId;
      }
      if (nodeId == this.wallet.address) {
        this.log.debug('got my own signature');
        gotOwnSignature = true;
      }
      await this.checkAddrInContract(nodeId);
      if (!isValidatorSignature) {
        await this.checkAttestorInToken(nodeId, vNodeId, blockSignedByV.getAttesttoken_asU8());
      }
      await BlockUtil.appendPatchAsValidator(this.wallet, blockSignedByVA, patch);
    }
    if (!gotOwnSignature) {
      throw new BlockError('no own signature found');
    }

    // ** safety check: full validation ONCE again
    let validatorSet = new Set(this.valContractState.getValidatorNodesMap().keys());
    let checkResult = await BlockUtil.checkBlockFinalized(blockSignedByVA,
      validatorSet, this.valContractState.contractCli.valPerBlock);
    if (!checkResult.success) {
      throw new BlockError('failed to produce block; self-validation failed for constructed block:' + checkResult.err);
    }
    // compare vs validator hash
    const expectedHash = BitUtil.bytesToBase16(asr.getFinalblockhash_asU8());
    const blockHash = BlockUtil.hashBlockAsHex(blockSignedByVA.serializeBinary());
    if (blockHash !== expectedHash) {
      throw new BlockError('block hash does not match the expected hash');
    }

    // ** deliver
    await this.publishFinalizedBlock(blockSignedByVA);

    // todo merge new slashing
    let response = new AttestSignaturesResponse();
    let attestorReport = new AttestorReport();
    attestorReport.setDataforsc(BitUtil.base16ToBytes("aa"));
    response.getAttestationsList().push(attestorReport)
    return response;
  }

  // checks that nodeId is registered in a smart contract as an active validator node
  // todo BlockUtil?
  // todo return type
  private async checkAddrInContract(nodeId: string): Promise<boolean> {
    const vi = this.valContractState.getValidatorNodesMap().get(nodeId);
    Check.notNull(vi, `Validator url is empty for node: ${nodeId}`);
    return true;
  }

  // checks that nodeId is registered in attestToken as a participant of the current block validation
  // todo BlockUtil?
  // todo return type
  private async checkAttestorInToken(nodeId: string, validatorIdToExclude: string, attestTokenB64: Uint8Array): Promise<boolean> {
    if (!this.random.checkAttestToken(nodeId, validatorIdToExclude, BitUtil.bytesUtfToString(attestTokenB64))) {
      this.log.error('block attest token is invalid')
      throw new BlockError('block attest token is invalid');
    }
    return true;
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
      Check.isTrue(this.nodeId != nodeId, 'wrong nodeid')
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


