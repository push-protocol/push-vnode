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
  Block,
  InitDid, Signer,
  Transaction,
  TransactionObj,
  TxAttestorData,
  TxValidatorData
} from "../../generated/push/block_pb";
import {BlockUtil} from "../messaging-common/blockUtil";
import {BitUtil} from "../../utilz/bitUtil";
import {TransactionError} from "./transactionError";
import {EthUtil} from "../../utilz/EthUtil";

// todo move read/write qurum to smart contract constants
// todo joi validate for getRecord
@Service()
export class ValidatorNode implements StorageContractListener {
  public log: Logger = WinstonUtil.newLog(ValidatorNode)

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
  // block
  private currentBlock: Block;
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
    }
    // check
    const tx = BlockUtil.parseTransaction(txRaw);
    this.log.debug('processing tx: %o', tx.toObject())
    if (validatorTokenRequired) {
      // check that this Validator is a valid target, according to validatorToken
      let valid = true;
      let validatorToken = BitUtil.bytesToBase64(<any>tx.getApitoken());
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
    this.checkValidTransactionFields(tx);
    // append transaction
    let txObj = new TransactionObj();
    txObj.setTx(tx);
    this.currentBlock.addTxobj(txObj);
    // todo handle bad conversions
    return true
  }

  private checkValidTransactionFields(tx: Transaction) {

    if (tx.getType() != 0) {
      throw new TransactionError(`Only non-value transactions are supported`);
    }
    let senderAddr = EthUtil.parseCaipAddress(tx.getSender());
    let recipientAddrs = tx.getRecipientsList().map(value => EthUtil.parseCaipAddress(value));
    let goodSender = !StrUtil.isEmpty(senderAddr.chainId) && !StrUtil.isEmpty(senderAddr.namespace)
      && !StrUtil.isEmpty(senderAddr.addr);
    if (!goodSender) {
      throw new TransactionError(`sender field is invalid ${tx.getSender()}`);
    }

    if (tx.getCategory() === 'INIT_DID') {
      let txData = InitDid.deserializeBinary(<any>tx.getData());
      if (StrUtil.isEmpty(txData.getDid())) {
        throw new TransactionError(`did missing`);
      }
      if (StrUtil.isEmpty(txData.getMasterpubkey())) {
        throw new TransactionError(`masterPubKey missing`);
      }
      if (StrUtil.isEmpty(txData.getDerivedpubkey())) {
        throw new TransactionError(`derivedPubKey missing`);
      }
      if (txData.getWallettoencderivedkeyMap().size < 1) {
        throw new TransactionError(`encDerivedPrivKey missing`);
      }
    } else if (tx.getCategory() === 'NOTIFICATION') {
      // todo checks
    } else {
      throw new TransactionError(`unsupported transaction category`);
    }
    if (StrUtil.isEmpty(BitUtil.bytesToBase16(<any>tx.getSalt()))) {
      throw new TransactionError(`salt field is invalid`);
    }

    let validSignature = true; // todo check signature
    if (!validSignature) {
      throw new TransactionError(`signature field is invalid`);
    }
  }


  /**
   * This method blocks for a long amount of time,
   * until processBlock() gets executed
   * @param p
   */
  public async sendTransactionBlocking(txRaw: Uint8Array): Promise<string> {
    // try {
      const monitor = new WaitNotify();
      let txHash = BlockUtil.calculateTransactionHashBase16(txRaw);
      this.blockMonitors.set(txHash, monitor)
      this.log.debug('adding monitor for transaction hash: %s', txHash)
      const success = await this.sendTransaction(txRaw, true);
      if (!success) {
        return null;
      }
      await monitor.wait(this.ADD_PAYLOAD_BLOCKING_TIMEOUT) // block until processBlock()
      return txHash;
    // } catch (e) {
    //   this.log.error(e)
    //   return null;
    // }
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


    // populate block
    block.setTs(DateUtil.currentTimeMillis());
    for (let txObj of block.getTxobjList()) {
      let vd = new TxValidatorData();
      vd.setVote(1);
      txObj.setValidatordata(vd);

      // todo fake attestation as of now (todo remove)
      let ad = new TxAttestorData();
      ad.setVote(1);
      txObj.setAttestordataList([ad, ad]);
    }
    const tokenObj = this.random.createAttestToken();
    this.log.debug('random token: %o', tokenObj);
    Check.isTrue(tokenObj.attestVector?.length > 0, 'attest vector is empty');
    Check.isTrue(tokenObj.attestVector[0] != null, 'attest vector is empty');
    block.setAttesttoken(BitUtil.stringToBytes(tokenObj.attestToken));

    // collect attestation per each transaction
    // and signature per block
    // from every attestor
    // todo
    // todo fake attestation as of now (todo remove)
    for (let txObj of block.getTxobjList()) {

      let ad = new TxAttestorData();
      ad.setVote(1);
      txObj.setAttestordataList([ad, ad]);
    }
    // todo fake signing as of now
    let vSign = new Signer();
    vSign.setSig("AA11");

    let aSign1 = new Signer();
    aSign1.setSig("11");

    let aSign2 = new Signer();
    aSign1.setSig("22");

    block.setSignersList([vSign, aSign1, aSign2]);

    /*
    // sign every response
    for (let i = 0; i < block.getTxobjList().length; i++) {
      const txObj = block.getTxobjList()[i];
      // TODO START FROM HERE !!!!!!!!!!!!!!!!!!!!!!!
      const nodeMeta = <NodeMeta>{
        nodeId: this.nodeId,
        role: NetworkRole.VALIDATOR,
        tsMillis: Date.now()
      }
      const fisData: FISData = {vote: 'ACCEPT'}
      const ethSig = await EthSig.create(this.wallet, feedItem, fisData, nodeMeta)
      const fiSig = new FeedItemSig(fisData, nodeMeta, ethSig)
      block.responsesSignatures.push([fiSig])
    }
    // network status

    const attestCount = 1
    const safeAttestCountToAvoidDuplicates = attestCount + 5
    // todo handle if some M amount of nodes refuses to attest!

    // attestor.attestBlock()
    const attesterArr: string[] = []
    for (let j = 0; j < tokenObj.attestVector.length; j++) {
      const attesterNodeId = tokenObj.attestVector[j]
      this.log.debug('requesting attestor: %s', attesterNodeId)
      const validatorInfo = this.valContractState.getValidatorNodesMap().get(attesterNodeId)
      Check.notNull(validatorInfo, `Validator url is empty for node: ${attesterNodeId}`)
      const apiClient = new ValidatorClient(validatorInfo.url)
      const reply = await apiClient.attest(block) // todo make parallel
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
        const fi = block.responses[i]
        const fiSig = reply.signatures[i]
        {
          // note: double safety check, don't merge incorrect signatures into the message block
          const valid = EthSig.check(
            fiSig.signature,
            fiSig.nodeMeta.nodeId,
            fi,
            fiSig.data,
            fiSig.nodeMeta
          )
          if (!valid) {
            const err = `attester ${attesterNodeId} produced invalid signature for response ${i}`
            this.log.error('%s %o for %o', err, fiSig, fi)
            throw new Error(err)
          }
          this.log.info(
            'attester %s produced valid signature for responses[%d]',
            attesterNodeId,
            i,
            fiSig
          )
        }
        block.responsesSignatures[i].push(fiSig)
      }
    }
    this.log.info('messageBlock after signature stage: %j', block)

    // attestor.attestSignatures()
    const nodeReportsMap = new Map<string, NodeReportSig[]>()
    for (const nodeId of attesterArr) {
      const validatorInfo = this.valContractState.getValidatorNodesMap().get(nodeId)
      const apiClient = new ValidatorClient(validatorInfo.url)
      const mbSignatures: MessageBlockSignatures = {
        id: block.id,
        responsesSignatures: block.responsesSignatures
      }
      const asResult: AttestSignaturesResult = await apiClient.attestSignatures(mbSignatures)
      if (asResult == null) {
        this.log.error('attestor %s failed to receive block signatures')
        throw new Error('failed to sign')
      } else if (asResult.reports?.length > 0) {
        const nodeId = asResult.reports[0].nodeId
        if (!nodeReportsMap.has(nodeId)) {
          nodeReportsMap.set(nodeId, [])
        }
        const arr = nodeReportsMap.get(nodeId)
        arr.push(...asResult.reports)
        this.log.debug('attestor %s successfully received block signatures and published the block')
      }
    }*/
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
    await this.publishCollectivelySignedMessageBlock(block);

    // 3: unblock addPayloadToMemPoolBlocking() requests
    for (let txObj of block.getTxobjList()) {
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
    return block
  }

  // sends message block to all connected delivery nodes
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
   * for every feedItem[i]: check signatures + check conversion results
   *
   * @param block message block
   * @returns a list of new feedItem[i] sinature
   */
  public async attestBlock(block: Readonly<MessageBlock>): Promise<AttestBlockResult> {
    // basic checks
    const activeValidators = new Set<string>(
      this.valContractState.getActiveValidators().map((ni) => ni.nodeId)
    )
    const check1 = MessageBlockUtil.checkBlock(block, activeValidators)
    if (!check1.success) {
      return {error: check1.err, signatures: null}
    }
    // attest token checks
    const item0sig0 = block.responsesSignatures[0][0]
    const blockValidatorNodeId = item0sig0?.nodeMeta.nodeId
    if (
      !this.random.checkAttestToken(
        block.attestToken,
        blockValidatorNodeId,
        this.valContractState.nodeId
      )
    ) {
      this.log.error('block attest token is invalid')
      return {error: 'block attest token is invalid', signatures: null}
    }
    // conversion checks
    const sigs: FeedItemSig[] = []
    for (let i = 0; i < block.responses.length; i++) {
      const payloadItem = block.requests[i]
      const feedItem = block.responses[i]
      this.log.debug('attestBlock() processing payloadItem %s', payloadItem.id)
      // check content
      const feedItemNew = await this.converterService.addExternalPayload(payloadItem)
      const fiHash = ObjectHasher.hashToSha256IgnoreRecipientsResolved(feedItem)
      const fiHashNew = ObjectHasher.hashToSha256IgnoreRecipientsResolved(feedItemNew)
      if (fiHashNew != fiHash) {
        this.log.error(
          `item %d feedItemNew: %j \n differs from feedItem: %j `,
          i,
          feedItemNew,
          feedItem
        )
        return null
      }
      // fuzzy check subscribers
      const cmpSubscribers = this.compareSubscribersDroppingLatestIsAllowed(feedItem, feedItemNew)
      if (!cmpSubscribers.subscribersAreEqual) {
        return {error: cmpSubscribers.error, signatures: null}
      }
      // sign
      const nodeMeta = <NodeMeta>{
        nodeId: this.nodeId,
        role: NetworkRole.ATTESTER,
        tsMillis: Date.now()
      }
      const fisData: FISData = {
        vote: 'ACCEPT',
        recipientsMissing: cmpSubscribers.comparisonResult
      }
      const ethSig = await EthSig.create(this.wallet, feedItem, fisData, nodeMeta)
      const fiSig = new FeedItemSig(fisData, nodeMeta, ethSig)

      sigs.push(fiSig)
    }
    // cache block in redis
    const key = 'node' + this.nodeId + 'blockId' + block.id
    await this.redisCli.getClient().set(key, JSON.stringify(block))
    const expirationInSeconds = 60
    await this.redisCli.getClient().expire(key, expirationInSeconds)
    return {error: null, signatures: sigs}
  }

  /**
   * Perform a comparison of 2 feedItems, fuzzy-checking their subscribers
   * Attester can drop ONLY fresh subscribers, and reply with RecipientsMissing field.
   *
   * @param itemV calculated by validator
   * @param itemA calculated by attester
   * @private
   */
  private compareSubscribersDroppingLatestIsAllowed(
    itemV: FeedItem,
    itemA: FeedItem
  ): { subscribersAreEqual: boolean; comparisonResult?: RecipientsMissing; error?: string } {
    const dbgPrefix = 'compareSubscribersDroppingLatestIsAllowed(): '
    this.log.debug('%s comparing %o with %o', dbgPrefix, itemA, itemV)
    const FRESH_SUBSCRIBER_THRESHOLD_MINUTES = 5
    // V = recipient (subsciber) found in Validator block, A = in Attester
    const recipientsV = itemV.header.recipientsResolved
    const recipientsA = itemA.header.recipientsResolved
    const recipientsAMap = Coll.arrayToMap(recipientsA, 'addr')
    const recipientsToRemove: RecipientsMissing = new RecipientsMissing()
    recipientsToRemove.sid = itemV.payload.data.sid
    const now = DateUtil.currentTimeSeconds()
    // check V subscribers against A subscribers
    // every V subscriber should be in A (we can ignore fresh records)
    for (const recipientV of recipientsV) {
      const recipientA = recipientsAMap.get(recipientV.addr)
      if (recipientA != null) {
        this.log.debug('%s %s exists in V,A', dbgPrefix, recipientA)
        recipientsAMap.delete(recipientV.addr)
        // A knows this address, don't do anything
        continue
      }
      const deltaInMinutes = (now - recipientV.ts) / 60
      const isFreshSubscriber = deltaInMinutes < FRESH_SUBSCRIBER_THRESHOLD_MINUTES
      if (!isFreshSubscriber) {
        const errMsg = `${recipientV.addr} (${deltaInMinutes}mins) exists in V, missing in A`
        this.log.error('%s %s', dbgPrefix, errMsg)
        return {subscribersAreEqual: false, error: errMsg}
      }
      // V has a subscriber, while A doesn't
      // we allow to ignore this if this subscriber is a 'fresh' one
      this.log.debug('%s is a fresh subscriber only in A', dbgPrefix, recipientA)
      const recipientMissing: RecipientMissing = {addr: recipientV.addr}
      recipientsToRemove.recipients.push(recipientMissing)
    }
    // check A subscribers against V subscribers
    // every A subscriber should be in V (we can ignore fresh records)
    for (const recipientA of recipientsAMap.values()) {
      const deltaInMinutes = (now - recipientA.ts) / 60
      const isFreshSubscriber = deltaInMinutes < FRESH_SUBSCRIBER_THRESHOLD_MINUTES
      if (!isFreshSubscriber) {
        const errMsg = `${recipientA.addr} (${deltaInMinutes}mins) exists in A, missing in V`
        this.log.error('%s %s', dbgPrefix, errMsg)
        return {subscribersAreEqual: false, error: errMsg}
      }
    }
    const result = {subscribersAreEqual: true, comparisonResult: recipientsToRemove}
    this.log.debug('%s result %s', dbgPrefix, result)
    return result
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
