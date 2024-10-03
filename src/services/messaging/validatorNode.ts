import {MsgConverterService} from './msgConverterService'
import {ObjectHasher} from '../../utilz/objectHasher'
import {ethers, Wallet} from 'ethers'
import {Inject, Service} from 'typedi'
import {Logger} from 'winston'
import {MsgDeliveryService} from './msgDeliveryService'
import {EthSig} from '../../utilz/ethSig'
import {ValidatorClient} from './validatorClient'
import {WaitNotify} from '../../utilz/waitNotify'
import {NodeInfo, ValidatorContractState} from '../messaging-common/validatorContractState'
import {ValidatorRandom} from './validatorRandom'
import {ValidatorPing} from './validatorPing'
import StrUtil from '../../utilz/strUtil'
import {
  FeedItem,
  FeedItemSig,
  FISData,
  MessageBlock,
  MessageBlockSignatures,
  MessageBlockUtil,
  NetworkRole,
  NodeMeta,
  RecipientMissing,
  RecipientsMissing
} from '../messaging-common/messageBlock'
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
import Subscribers, {SubscribersItem} from '../channelsCompositeClasses/subscribersClass'
import config from '../../config'
import ChannelsService from '../channelsService'
import {MySqlUtil} from '../../utilz/mySqlUtil'
import {EnvLoader} from "../../utilz/envLoader";
import {
  AttestorReply,
  Block,
  InitDid, Signer,
  Transaction,
  TransactionObj,
  TxAttestorData,
  TxValidatorData, Vote
} from "../../generated/push/block_pb";
import {BlockUtil} from "../messaging-common/blockUtil";
import {BitUtil} from "../../utilz/bitUtil";
import {TransactionError} from "./transactionError";
import {EthUtil} from "../../utilz/EthUtil";
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

  @Inject()
  private deliveryService: MsgDeliveryService

  @Inject()
  private converterService: MsgConverterService

  @Inject()
  private subscribers: Subscribers

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
    // todo handle bad conversions
    return true
  }



  /**
   * This method blocks for a long amount of time,
   * until processBlock() gets executed
   */
  public async sendTransactionBlocking(txRaw: Uint8Array): Promise<string> {
      const monitor = new WaitNotify();
      let txHash = BlockUtil.calculateTransactionHashBase16(txRaw);
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
   * Add first signature and start processing
   * @param cronJob
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
    this.log.debug('blockBytesToSign %s', BitUtil.bytesToBase16(blockBytesToSign));
    const ethSig = await EthSig.signBytes(this.wallet, blockBytesToSign);
    let vSign = new Signer();
    vSign.setSig(ethSig);
    block.setSignersList([vSign]);
    let blockSignedByV = block;
    this.log.debug('built block: %o', blockSignedByV.toObject());

    // ** A's attest block
    // todo [local debug] attestation
    Check.isTrue(blockSignedByV.getSignersList().length == 1);
    for (const txObj of blockSignedByV.getTxobjList()) {
      Check.isTrue(txObj.getAttestordataList().length == 0);
    }

    let blockBytesToAttest = blockSignedByV.serializeBinary();

    let attestorReply;
    try {
      attestorReply = await this.attestBlock(blockBytesToAttest);
    } catch (e) {
      this.log.error('failed to attest', e);
    }

    // ** V checks attestation
    // make a block copy; and fill it with the reply
    // all the attestorData + signatures come only from the single source
    // the only purpose is to check that A signed the data correctly
    let tmpBlock = Block.deserializeBinary(blockSignedByV.serializeBinary());
    // tx0 -> attest0, ...
    // is restructured into
    // block.txObj[0].tx -> attest0, ...
    for(let txIndex = 0; txIndex < tmpBlock.getTxobjList().length; txIndex++) {
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
    // **V merges A's attestation
    for(let txIndex = 0; txIndex < tmpBlock.getTxobjList().length; txIndex++) {
      let attestDataPerTx = attestorReply.getAttestordataList()[txIndex];
      blockSignedByVA.getTxobjList()[txIndex].setAttestordataList([attestDataPerTx]);
    }
    blockSignedByVA.getSignersList().push(attestorReply.getSigner());

    this.log.debug('block after merging attestations: %o',  blockSignedByVA.toObject());

    /*


    const attesterArr: string[] = [];
    for (let j = 0; j < tokenObj.attestVector.length; j++) {
      const attesterNodeId = tokenObj.attestVector[j]
      this.log.debug('requesting attestor: %s', attesterNodeId)
      const validatorInfo = this.valContractState.getValidatorNodesMap().get(attesterNodeId)
      Check.notNull(validatorInfo, `Validator url is empty for node: ${attesterNodeId}`)
      const apiClient = new ValidatorClient(validatorInfo.url)
      const reply = await apiClient.attest(block) // todo 1) PARALLEL CALLS 2) JSON RPC
      if (reply == null || reply.error != null) {
        this.log.error(
          'attestor %s failed to sign the block, reason: %s',
          attesterNodeId,
          reply?.error
        )
        throw new Error('failed to sign') // todo remove
      } else {
        attesterArr.push(attesterNodeId)
        this.log.error('attestor %s successfully signed the block', attesterNodeId)
        this.log.info('fiSignatures: %o', reply.signatures)
      }
      for (let i = 0; i < block.responsesSignatures.length; i++) {
        // todo check signatures
      }
    }*/


      // network status


    // group same reports , take one
    // todo
    // const sortedNodeReports = Coll.sortMapOfArrays(nodeReportsMap, false);
    // if(sortedNodeReports.size > 0) {
    //   let firstEntry:[string, NodeReportSig[]] = sortedNodeReports.entries().next().value;
    //   this.log.debug('processing entry', firstEntry);
    //   let [key, reports] = firstEntry;
    //
    // }
    // call a contract

    // 2: deliver
    await this.publishCollectivelySignedMessageBlock(blockSignedByVA);

    // 3: unblock addPayloadToMemPoolBlocking() requests
    for (let txObj of blockSignedByVA.getTxobjList()) {
      let tx = txObj.getTx();
      let txHash = BlockUtil.calculateTransactionHashBase16(tx.serializeBinary());

      const objMonitor = blockMonitors.get(txHash);
      if (objMonitor) {
        this.log.debug('unblocking monitor %s', objMonitor);
        objMonitor.notifyAll();
      } else {
        this.log.debug('no monitor found for id %s', txHash);
      }
    }
    return blockSignedByVA
  }


  public async publishCollectivelySignedMessageBlock(mb: Block) {
    const queue = this.queueInitializer.getQueue(QueueManager.QUEUE_MBLOCK);
    let blockBytes = mb.serializeBinary();
    let blockAsBase16 = BitUtil.bytesToBase16(blockBytes);
    const blockHashAsBase16 = BlockUtil.calculateBlockHashBase16(blockBytes);
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
   * @param blockRaw message block as bytes
   * @returns
   */
  public async attestBlock(blockRaw: Uint8Array): Promise<AttestorReply> {
    // basic checks
    const activeValidators = new Set<string>(
      this.valContractState.getActiveValidators().map((ni) => ni.nodeId)
    )
    let block = BlockUtil.parseBlock(blockRaw);
    const check1 = await BlockUtil.checkBlock(block, activeValidators)
    if (!check1.success) {
      throw new BlockError(check1.err); //todo reply with error here ?
    }

    // ** check validator signature,
    const validatorSignature = block.getSignersList()[0]?.getSig_asU8();
    Check.notNull(validatorSignature, "validator signature is required");
    let blockObj = Block.deserializeBinary(blockRaw);
    blockObj.clearSignersList();
    let blockBytesNoSigners = blockObj.serializeBinary();
    const blockValidatorNodeId = EthSig.recoverAddressFromMsg(blockBytesNoSigners, validatorSignature);
    this.log.debug('blockValidatorNodeId %o', blockValidatorNodeId);
    const validatorInfo = this.valContractState.getValidatorNodesMap().get(blockValidatorNodeId)
    Check.notNull(validatorInfo, `Validator url is empty for node: ${blockValidatorNodeId}`)
    // todo add additional check that this was a valid attestor from the array of attestors

    // ** check attest token
/*
    TODO enable it!!!!!!!!!!!!!!
    if (
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
    Check.isTrue(block.getSignersList().length == 1);
    for (const txObj of block.getTxobjList()) {
      Check.isTrue(txObj.getAttestordataList().length == 0);
    }
    let ar = new AttestorReply();
    for (let txObj of block.getTxobjList()) {
      let vote = await this.attestorVoteOnTransaction(txObj);
      ar.addAttestordata(vote);
      txObj.setAttestordataList([vote]); // block:  only my vote per transaction
    }
    let blockBytes = block.serializeBinary();
    this.log.debug('signing block with hash: %s', EthSig.ethHash(blockBytes));
    const ethSig = await EthSig.signBytes(this.wallet, blockBytes); // block: sign bytes
    let signer = new Signer();
    signer.setSig(ethSig);
    ar.setSigner(signer);

    return ar;
  }

  // I approve every valid transaciton (as of now)
  private async validatorVoteOnTransaction(txObj: TransactionObj): Promise<TxValidatorData> {
    let result = new TxValidatorData();
    // no additional checks are needed - since we're checking transaction while adding to block
    result.setVote(Vote.ACCEPTED);
    return result;
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
   * Simply receive all signatures from Validator,
   * after the block is already assembled
   * and signed by every party
   * @param blockSig
   */
  public async attestSignatures(
    blockSig: Readonly<MessageBlockSignatures>
  ): Promise<AttestSignaturesResult> {
    this.log.debug('attestSignatures() %s', blockSig)
    // get cached block from redis
    const key = 'node' + this.nodeId + 'blockId' + blockSig.id
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
    await this.publishCollectivelySignedMessageBlock(mb)
    this.log.debug('attestSignatures() success')
    return result
  }

  isMajority(value: number, total: number): boolean {
    return value > (total * 2.0) / 3.0
  }

  /*
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

// attester replies with a list of signatures of every feed item in a block and yes/no
export class AttestBlockResult {
  // error is filled if we reject to sign
  error: string | null
  signatures: FeedItemSig[] | null
}

// attester replies with a list of votes against minority of nodes, which voted not like this node.
export class AttestSignaturesResult {
  reports: NodeReportSig[] = []
}
