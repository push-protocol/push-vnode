import {ethers, Wallet} from 'ethers'
import {Inject, Service} from 'typedi'
import {Logger} from 'winston'
import {EthUtil} from '../../utilz/ethUtil'
import {ValidatorClient} from './validatorClient'
import {WaitNotify} from '../../utilz/waitNotify'
import {NodeInfo, ValidatorContractState} from '../messaging-common/validatorContractState'
import {ValidatorRandom} from './validatorRandom'
import {ValidatorPing} from './validatorPing'
import {StrUtil} from '../../utilz/strUtil'
import {FeedItem, FeedItemSig} from '../messaging-common/messageBlock'
import {WinstonUtil} from '../../utilz/winstonUtil'
import {RedisClient} from '../messaging-common/redisClient'
import {DateUtil} from '../../utilz/dateUtil'
import {QueueManager} from './QueueManager'
import {Check} from '../../utilz/check'
import {StorageContractListener, StorageContractState} from '../messaging-common/storageContractState'
import {PromiseUtil} from '../../utilz/promiseUtil'
import StorageClient, {KeyInfo, TxInfo} from './storageClient'
import {NodeHttpStatus, Rec, ReplyMerger} from './ReplyMerger'
import {EnvLoader} from "../../utilz/envLoader";
import {
  AttestBlockResult,
  AttestorReport,
  AttestSignaturesRequest,
  AttestSignaturesResponse,
  Block,
  Signer,
  TransactionObj,
  TxAttestorData,
  Vote
} from "../../generated/push/block_pb";
import {BlockUtil} from "../messaging-common/blockUtil";
import {BitUtil} from "../../utilz/bitUtil";
import {TransactionError} from "./transactionError";
import {BlockError} from "./blockError";
import {ArrayUtil} from "../../utilz/arrayUtil";
import {RandomUtil} from "../../utilz/randomUtil";
import {RpcError} from "../../utilz/jsonRpcClient";
import {ChainUtil} from "../../utilz/chainUtil";
import {Tuple} from "../../utilz/tuple";
import ArchivalClient from "./archivalClient";

// todo move read/write qurum to smart contract constants
// todo joi validate for getRecord
@Service()
export class ValidatorNode implements StorageContractListener {
  public log: Logger = WinstonUtil.newLog(ValidatorNode);

  private static readonly BLOCK_BUFFER_DELAY = EnvLoader.getPropertyAsNumber("BLOCK_BUFFER_DELAY", 30000);
  private readonly TX_BLOCKING_API_MAX_TIMEOUT = 45000

  // percentage of node to read (from the total active count of snodes)
  private readonly READ_QUORUM_PERC_INITDID = 0.51;
  // percentage of node to read (from the affected shard snodes)
  private readonly READ_QUORUM_PERC = 0.6;
  // how many nodes to add for safety on top of READ_QUORUM_PERC
  // we plan some amount of nodes + some buffer; if this is successfull or the failure rate is less than buffer
  // all the logic would end in O(1) because all queries are parallel
  private readonly READ_QUORUM_REDUNDANCY = 1;

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
  private currentBlock: Block = null;
  // total serialized length of all transactions; used as a watermark (cleared on every cron event)
  private totalTransactionBytes: number;

  private blockTimeout: NodeJS.Timeout = null;
  // objects used to wait on block
  private blockMonitors: Map<string, WaitNotify> = new Map<string, WaitNotify>()

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
    if (EthUtil.isEthZero(this.nodeId) || StrUtil.isEmpty(this.nodeId)) {
      throw new Error('invalid node id: ' + this.nodeId)
    }
    this.log.debug(`done loading eth config, using wallet %s`, this.nodeId)
    this.validatorPing.postConstruct()
    this.random.postConstruct()
  }

  // ------------------------------ VALIDATOR -----------------------------------------

  //@Deprecated
  public getAllNodesMap(): Map<string, NodeInfo> {
    return this.valContractState.getAllNodesMap()
  }

  public async sendTransaction(txRaw: Uint8Array, validatorTokenRequired: boolean): Promise<string> {
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
      throw new Error('block is full, tx count: ' + this.currentBlock.getTxobjList().length
        + '. Please retry.');
    }
    if (this.totalTransactionBytes >= BlockUtil.MAX_TOTAL_TRANSACTION_SIZE_BYTES) {
      // todo improve
      // as of now - we simply reject the transaction
      // it's the sender's responsibility to retry in a while
      this.log.info('block is full; totalTransactionBytes: %d ; limit: %d ',
        this.totalTransactionBytes, BlockUtil.MAX_TOTAL_TRANSACTION_SIZE_BYTES);
      throw new Error('block is full, tx count: ' + this.currentBlock.getTxobjList().length
        + '. Please retry.');
    }
    // check
    const tx = BlockUtil.parseTx(txRaw);
    this.log.debug('processing tx: %o', tx.toObject())
    if (validatorTokenRequired) {
      // check that this Validator is a valid target, according to validatorToken
      let valid = true;
      let validatorToken = BitUtil.bytesUtfToString(tx.getApitoken_asU8());
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
    let txCheck = await BlockUtil.checkTx(tx);
    if (!txCheck.success) {
      throw new BlockError(txCheck.err);
    }
    let txHash = BlockUtil.hashTxAsHex(txRaw);
    // append transaction
    let txObj = new TransactionObj();
    txObj.setTx(tx);
    this.currentBlock.addTxobj(txObj);
    // note: were he serialize 1 transaction to increment the total size
    this.totalTransactionBytes += tx.serializeBinary().length;
    this.log.debug(`block contains %d transacitons, totalling as %d bytes`,
      this.currentBlock.getTxobjList().length, this.totalTransactionBytes);
    this.tryScheduleBlock();
    return txHash
  }

  // todo: extend timer by +200ms if new tx comes,
  //  but no more than 500ms in total delay from the first tx registered and waiting

  public tryScheduleBlock() {
    if (this.blockTimeout != null) {
      // we have already scheduled the batch processing
      // the timer is on
      // no need to add one more
      this.log.debug("BLOCK: a block is already scheduled")
      return;
    }
    this.log.debug("BLOCK: scheduling new block in %s ms", ValidatorNode.BLOCK_BUFFER_DELAY)
    this.blockTimeout = setTimeout(async () => {
      try {
        this.log.debug("BLOCK: producing a block")
        let b = await this.batchProcessBlock(true);
      } catch (e) {
        this.log.error('error', e);
      } finally {
        // allow new timer to get registered
        this.blockTimeout = null;
      }
    }, ValidatorNode.BLOCK_BUFFER_DELAY);
  }


  /**
   * This method blocks for a long amount of time,
   * until processBlock() gets executed
   *
   * USE ONLY FOR INTERNAL DEV TASKS; THIS DOES NOT SCALE WELL FOR SOME NODEJS REASONS
   */
  public async sendTransactionBlocking(txRaw: Uint8Array): Promise<string> {
    const monitor = new WaitNotify();
    let txHash = BlockUtil.hashTxAsHex(txRaw);
    this.blockMonitors.set(txHash, monitor)
    this.log.debug('adding monitor for transaction hash: %s', txHash)
    txHash = await this.sendTransaction(txRaw, true);
    await monitor.wait(this.TX_BLOCKING_API_MAX_TIMEOUT); // block until processBlock()
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
    const attestVector = tokenObj.attestVector;
    Check.isTrue(attestVector?.length > 0, 'attest vector is empty');
    Check.isTrue(attestVector[0] != null, 'attest vector is empty');
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

    // ** A1-AN get patches (network attestations) (parallel, but reply processing is sequential)

    const attestersWhichSignedBlock: string[] = [];
    const patches: AttestBlockResult[] = [];
    let prList: Promise<Tuple<AttestBlockResult, RpcError>>[] = [];
    for (let j = 0; j < attestVector.length; j++) {
      // ** A0 attests the block
      const attesterNodeId = attestVector[j];
      this.log.debug('requesting attestor: %s [%d / %d]', attesterNodeId, j + 1, attestVector.length);
      const vi = this.valContractState.getValidatorNodesMap().get(attesterNodeId);
      Check.notNull(vi, `Validator url is empty for node: ${attesterNodeId}`);
      const apiClient = new ValidatorClient(vi.url);
      prList.push(apiClient.v_attestBlock(blockSignedByVBytes));
    }
    const prResults = await PromiseUtil.allSettled(prList);
    for (let j = 0; j < prResults.length; j++) {
      const prResult = prResults[j];
      const attesterNodeId = attestVector[j];
      if (!prResult.isSuccess()) {
        this.log.error('attestor %s failed to attest the block, reason: %s', attesterNodeId, prResult.err || "network err");
        throw new Error('failed to attest by validator ' + attesterNodeId); // todo remove; add 'extra' validators
      }
      const [patch, attestorErr] = prResult.val;
      if (attestorErr != null) {
        this.log.error('attestor %s failed to attest the block, reason: %s', attesterNodeId, attestorErr);
        throw new Error('failed to attest by validator ' + attesterNodeId); // todo remove;  add 'extra' validators
      }
      attestersWhichSignedBlock.push(attesterNodeId);
      this.log.debug('attestor %s successfully signed the block, %o',
        attesterNodeId, patch != null ? patch.toObject() : "");
      // ** V checks A0 attestation
      let nodeAddress = await BlockUtil.recoverPatchAddress(this.wallet, blockSignedByV, patch);
      let correctAttestor = this.checkAddrInContract(nodeAddress);
      Check.isTrue(correctAttestor, `Validator url is empty for node: ${nodeAddress}`)

      await BlockUtil.appendPatchAsValidator(this.wallet, block, patch);
      patches.push(patch);
    }
    let blockSignedByVA = block;
    let blockSignedByVAHash = BlockUtil.hashBlockAsHex(blockSignedByVA.serializeBinary());
    this.log.debug('finalized block: %o', blockSignedByVA.toObject());
    this.log.debug('finalized block hash: %s', blockSignedByVAHash);

    // ** A1-AN send all patches (parallel)

    let asr = new AttestSignaturesRequest();
    asr.setInitialblockhash(BitUtil.base16ToBytes(blockSignedByVHash));
    asr.setFinalblockhash(BitUtil.base16ToBytes(blockSignedByVAHash));
    asr.setAttestationsList(patches);
    this.log.debug('sending patches %o', asr.toObject());
    this.log.debug('Initialblockhash %s', BitUtil.bytesToBase16(asr.getInitialblockhash_asU8()));
    this.log.debug('Finalblockhash %s', BitUtil.bytesToBase16(asr.getFinalblockhash_asU8()));
    let prList2: Promise<Tuple<AttestSignaturesResponse, RpcError>>[] = [];
    for (let j = 0; j < attestVector.length; j++) {
      // ** A0 attests the block
      const attestorNodeId = attestVector[j];
      this.log.debug('requesting attestor: %s [%d / %d]', attestorNodeId, j + 1, attestVector.length);
      const vi = this.valContractState.getValidatorNodesMap().get(attestorNodeId);
      Check.notNull(vi, `Validator url is empty for node: ${attestorNodeId}`);
      const apiClient = new ValidatorClient(vi.url);
      prList2.push(apiClient.v_attestSignatures(asr));
    }
    const prResults2 = await PromiseUtil.allSettled(prList2);
    for (let j = 0; j < prResults2.length; j++) {
      const prResult = prResults2[j];
      const attestorNodeId = attestVector[j];
      if (!prResult.isSuccess()) {
        this.log.error('attestor %s failed to accept sigs for the block, reason: %s', attestorNodeId, prResult.err || "network err");
        throw new Error('failed to attest sigs by validator ' + attestorNodeId); // todo remove; add 'extra' validators
      }
      const [resp, attestorErr] = prResult.val;
      if (attestorErr != null) {
        this.log.error('attestor %s failed to attest signatures, reason: %s resp: %s', attestorNodeId, attestorErr, resp);
        throw new Error('failed to attest signatures'); // todo remove
      }
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
    let checkResultForSNode = await BlockUtil.checkBlockAsSNode(blockSignedByVA,
      validatorSet, this.valContractState.contractCli.valPerBlock);
    if (!checkResultForSNode.success) {
      throw new BlockError('failed to produce block; self-validation failed for constructed block:' + checkResult.err);
    }

    // ** deliver
    await this.publishFinalizedBlock(blockSignedByVA);

    // ** unblock addPayloadToMemPoolBlocking() requests
    for (let txObj of blockSignedByVA.getTxobjList()) {
      let tx = txObj.getTx();
      let txHash = BlockUtil.hashTxAsHex(tx.serializeBinary());

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


  public async publishFinalizedBlock(block: Block) {
    const blockRaw = block.serializeBinary();
    const blockHashHex = BlockUtil.hashBlockAsHex(blockRaw);
    const blockHex = BitUtil.bytesToBase16(blockRaw);
    const affectedShards = BlockUtil.calculateAffectedShards(block, this.storageContractState.shardCount);
    const affectedSNodes = new Set<string>();
    for (const shardId of affectedShards) {
      const nodes = this.storageContractState.getStorageNodesForShard(shardId);
      for (const node of nodes) {
        affectedSNodes.add(node);
      }
    }
    this.log.debug("affectedSNodes: %s", StrUtil.fmt(affectedSNodes));
    const affectedANodes = [...this.valContractState.getArchivalNodesMap().keys()];
    this.log.debug("affectedANodes: %s", StrUtil.fmt(affectedANodes));
    /*
    RPC SEND (parallel)
    this part does not require 100% durability because if RPC is not successful
    1) we can retry
    2) snodes can poll vnodes later, unless the data has already expired
    todo: send batches of blocks to every node; if an optimized version is needed; api allows this;
    */
    const retryCount = EnvLoader.getPropertyAsNumber("SEND_BLOCK_RETRY_COUNT", 2);
    const retryDelay = EnvLoader.getPropertyAsNumber("SEND_BLOCK_RETRY_DELAY", 30000);
    let prList: Promise<void>[] = [];

    for (const nodeId of affectedSNodes) {
      const p = this.sendBlockToSNodeWithRetries(nodeId, blockHashHex, blockHex, retryDelay, retryCount)
        .then(value => {
          if (value == NodeSendResult.ERROR_CAN_RETRY) {
            this.log.error("error executing putBlock to snode %s; Will retry later %d times", nodeId, retryDelay);
          } else {
            this.log.debug("successfully executed putBlock to snode %s", nodeId);
          }
        })
        .catch(reason => {
          this.log.error("error executing putBlock to snode %s : %s", nodeId, reason);
        });
      prList.push(p);
    }

    for (const nodeId of affectedANodes) {
      const p = this.sendBlockToANodeWithRetries(nodeId, blockHashHex, blockHex, 0, 0)
        .then(value => {
          this.log.debug("successfully executed putBlock to anode %s", nodeId);
        })
        .catch(reason => {
          this.log.error("error executing putBlock to anode %s : %s", nodeId, reason, retryDelay, retryCount);
        });
      prList.push(p);
    }

    // wait for all; to slow the api;
    // todo think about return criteria: i.e. write to N of M snodes right away = success , or some % of durable save
    const prResults = await PromiseUtil.allSettled(prList);
    // QUEUE PUBLISH (for polling)
    // todo remove when anode will get apis
    const queue = this.queueInitializer.getQueue(QueueManager.QUEUE_MBLOCK);
    let blockBytes = block.serializeBinary();
    let blockAsBase16 = BitUtil.bytesToBase16(blockBytes);
    const blockHashAsBase16 = BlockUtil.hashBlockAsHex(blockBytes);
    const insertResult = await queue.accept({
      object: blockAsBase16,
      object_hash: blockHashAsBase16
    });
    this.log.debug(`published message block ${blockHashAsBase16} success: ${insertResult}`)
  }

  // only 1st send in synchronous; retries are async
  private async sendBlockToSNodeWithRetries(nodeId: string, blockHashHex: string, blockHex: string, retryDelay: number, retriesLeft: number): Promise<NodeSendResult> {
    const res = await this.sendBlockToSNode(nodeId, blockHashHex, blockHex);
    if (res === NodeSendResult.ERROR_CAN_RETRY && retriesLeft > 0) {
      setTimeout(() => {
        this.sendBlockToSNodeWithRetries(nodeId, blockHashHex, blockHex, retryDelay, retriesLeft - 1);
      }, retryDelay);
    }
    return res;
  }

  private async sendBlockToSNode(nodeId: string, blockHashHex: string, blockHex: string): Promise<NodeSendResult> {
    const nodeInfo = this.valContractState.getStorageNodesMap().get(nodeId)
    Check.notNull(nodeInfo, 'node info unknown for ' + nodeId);
    if (!ValidatorContractState.isEnabled(nodeInfo)) {
      return NodeSendResult.DO_NOT_RETRY;
    }
    const nodeBaseUrl = nodeInfo.url;
    if (StrUtil.isEmpty(nodeBaseUrl)) {
      this.log.error(`node: ${nodeId} has no url in the database`)
      return NodeSendResult.DO_NOT_RETRY;
    }
    this.log.debug(`delivering block (hash=%s) to node %s baseUrl=%s`, blockHashHex, nodeId, nodeBaseUrl);
    const client = new StorageClient(nodeBaseUrl);
    let [reply1, err] = await client.push_putBlockHash([blockHashHex]);
    if (err != null) {
      this.log.error(`Error pushing block hash to node: ${nodeId}, error: ${err.toString()}`);
      return NodeSendResult.ERROR_CAN_RETRY;
    }
    if (reply1 == null || reply1.length == 0) {
      return NodeSendResult.ERROR_CAN_RETRY;
    }
    const hashReply = reply1[0];
    // todo add if for: hashReply == "DO_NOT_SEND"
    if (hashReply !== "SEND") {
      this.log.error('Ignoring block delivery (DO_NOT_SEND) to node: %s', nodeId);
      return NodeSendResult.DO_NOT_RETRY;
    }
    const [reply2, err2] = await client.push_putBlock([blockHex]);
    if (err2 != null) {
      this.log.error(`Error pushing block to node: ${nodeId}`);
      return NodeSendResult.ERROR_CAN_RETRY;
    }
    this.log.debug('reply: %s', StrUtil.fmt(reply2));
    return NodeSendResult.SENT;
  }

  // todo optimize ; fix anode api to be the same as snode api
  private async sendBlockToANodeWithRetries(nodeId: string, blockHashHex: string, blockHex: string, retryDelay: number, retriesLeft: number): Promise<void> {
    const res = await this.sendBlockToANode(nodeId, blockHashHex, blockHex);
    if (res === NodeSendResult.ERROR_CAN_RETRY && retriesLeft > 0) {
      setTimeout(() => {
        this.sendBlockToSNodeWithRetries(nodeId, blockHashHex, blockHex, retryDelay, retriesLeft - 1);
      }, retryDelay);
    }
  }

  private async sendBlockToANode(nodeId: string, blockHashHex: string, blockHex: string, nodeUrlOverride?: string): Promise<NodeSendResult> {
    let nodeBaseUrl;
    if (!StrUtil.isEmpty(nodeUrlOverride)) {
      nodeBaseUrl = nodeUrlOverride;
    } else {
      const nodeInfo = this.valContractState.getArchivalNodesMap().get(nodeId)
      Check.notNull(nodeInfo, 'node info unknown for ' + nodeId);
      if (!ValidatorContractState.isEnabled(nodeInfo)) {
        return NodeSendResult.DO_NOT_RETRY;
      }
      nodeBaseUrl = nodeInfo.url;
    }

    if (StrUtil.isEmpty(nodeBaseUrl)) {
      this.log.error(`node: ${nodeId} has no url in the database`)
      return NodeSendResult.DO_NOT_RETRY;
    }
    this.log.debug(`delivering block (hash=%s) to node %s baseUrl=%s`, blockHashHex, nodeId, nodeBaseUrl);
    const client = new ArchivalClient(nodeBaseUrl);
    let [reply1, err] = await client.push_putBlockHash([blockHashHex]);
    if (err != null) {
      this.log.error(`Error pushing block hash to node: ${nodeId}, error: ${err.toString()}`);
      return NodeSendResult.ERROR_CAN_RETRY;
    }
    if (reply1 == null || reply1.length == 0) {
      return NodeSendResult.ERROR_CAN_RETRY;
    }
    const hashReply = reply1[0];
    if (hashReply !== "SEND") {
      this.log.error('Ignoring block delivery (DO_NOT_SEND) to node: %s', nodeId);
      return NodeSendResult.DO_NOT_RETRY;
    }
    const [reply2, err2] = await client.push_putBlock([blockHex]);
    if (err2 != null) {
      this.log.error(`Error pushing block to node: ${nodeId}`);
      return NodeSendResult.ERROR_CAN_RETRY;
    }
    this.log.debug('reply: %s', StrUtil.fmt(reply2));
    return NodeSendResult.SENT;
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
    if (blockSignedByV.getTxobjList().length >= BlockUtil.MAX_TRANSACTIONS_PER_BLOCK) {
      for (const b of blockSignedByV.getTxobjList()) {

      }
    }
    this.log.debug('attestBlock(): received blockSignedByVBytes: %s', BitUtil.bytesToBase16(blockSignedByVBytes));
    this.log.debug('attestBlock(): received blockSignedByV: %o', blockSignedByV.toObject());
    const check1 = await BlockUtil.checkBlockAsAttestor(blockSignedByV, activeValidators);
    if (!check1.success) {
      throw new BlockError(check1.err); //todo reply with error here ?
    }
    const blockValidatorNodeId = await BlockUtil.recoverSignerAddress(blockSignedByV, 0);
    for (let i = 0; i < blockSignedByV.getTxobjList().length; i++) {
      const txObj = blockSignedByV.getTxobjList()[i];
      const apiToken = BitUtil.bytesUtfToString(txObj.getTx().getApitoken_asU8());
      if (!this.random.checkValidatorToken(apiToken, blockValidatorNodeId)) {
        throw new BlockError('invalid validator for transaction #' + i);
      }
    }
    // ** check validator signature,

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
    this.log.debug('signing block with hash: %s', EthUtil.ethHash(blockBytes));
    const ethSig = await EthUtil.signBytes(this.wallet, blockBytes); // block: sign bytes
    let signer = new Signer();
    signer.setSig(ethSig);
    ar.setSigner(signer);

    return ar;
  }

  // I approve every valid transaciton (as of now)
  private async attestorVoteOnTransaction(txObj: TransactionObj): Promise<TxAttestorData> {
    let result = new TxAttestorData();

    let txCheck = await BlockUtil.checkTx(txObj.getTx());
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

    // ** delayed deliver
    const min = EnvLoader.getPropertyAsNumber("SEND_BLOCK_AS_ATTESTOR_MIN_DELAY", 5000);
    const max = EnvLoader.getPropertyAsNumber("SEND_BLOCK_AS_ATTESTOR_MAX_DELAY", 30000);
    let rndDelay = RandomUtil.getRandomInt(min, max);
    setTimeout(async () => {
      try {
        this.log.debug("delivering a block as attestor with random delay of %s ms", rndDelay)
        let b = await this.publishFinalizedBlock(blockSignedByVA);
      } catch (e) {
        this.log.error('error', e);
      }
    }, rndDelay);

    // todo merge new slashing
    let response = new AttestSignaturesResponse();
    let attestorReport = new AttestorReport();
    attestorReport.setDataforsc(BitUtil.base16ToBytes("aa"));
    response.getAttestationsList().push(attestorReport)
    return response;
  }

  // checks that nodeId is registered in a smart contract as an active validator node
  private async checkAddrInContract(nodeId: string): Promise<boolean> {
    const vi = this.valContractState.getValidatorNodesMap().get(nodeId);
    Check.notNull(vi, `Validator url is empty for node: ${nodeId}`);
    return true;
  }

  // checks that nodeId is registered in attestToken as a participant of the current block validation
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
      const reportDataSig = await EthUtil.signForContract(this.wallet, reportData)
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


  public async accountInfo(caipOrDid: string) {
    Check.isTrue(ChainUtil.isFullCAIPAddress(caipOrDid) || ChainUtil.isPushDid(caipOrDid), 'non-CAIP address' + caipOrDid);
    const sNodes = Array.from(this.storageContractState.nodeShardMap.keys());
    // query1 = we plan some amount of nodes + some buffer; if this is successfull or the failure rate is less than buffer
    // all the logic would end in O(1) because all queries are parallel
    const quorumNodeCount = Math.round(this.READ_QUORUM_PERC_INITDID * sNodes.length);
    const query1Size = Math.min(quorumNodeCount + this.READ_QUORUM_REDUNDANCY, sNodes.length);
    this.log.debug('sNodesCount: %d, query1Size: %d', sNodes.length, query1Size);
    const query1Nodes = RandomUtil.getRandomSubArray(sNodes, query1Size);
    this.log.debug('sNodeCount: %d quorumNodeCount: %d query1Size: %d query1Nodes: %s', sNodes.length, quorumNodeCount, query1Size, query1Nodes);

    // prepare queries
    const promiseList: Promise<Tuple<KeyInfo, RpcError>>[] = [];
    for (let i = 0; i < query1Nodes.length; i++) {
      this.log.debug('query');
      const nodeId = query1Nodes[i];
      const nodeInfo = this.valContractState.getStorageNodesMap().get(nodeId)
      Check.notNull(nodeInfo)
      if (!ValidatorContractState.isEnabled(nodeInfo)) {
        continue
      }
      const nodeBaseUrl = nodeInfo.url
      if (StrUtil.isEmpty(nodeBaseUrl)) {
        this.log.error(`node: ${nodeId} has no url in the database`);
        continue
      }
      this.log.debug(`baseUrl=${nodeBaseUrl}`);
      const client = new StorageClient(nodeBaseUrl);
      promiseList.push(client.push_accountInfo(caipOrDid));
    }

    // await them
    const prList = await PromiseUtil.allSettled(promiseList);

    // handle replies
    const arh = new ReplyMerger();
    for (let i = 0; i < query1Nodes.length; i++) {
      const nodeId = query1Nodes[i]
      const pr = prList[i];
      if (pr.isRejected()) {
        arh.appendHttpCode(nodeId, NodeHttpStatus.REPLY_TIMEOUT);
        continue;
      }
      let [keyInfo, err] = pr.val;
      if (err != null) {
        this.log.error('error from node: %s message: %o', nodeId, err);
        arh.appendHttpCode(nodeId, 500);
        continue;
      }
      arh.appendHttpCode(nodeId, 200);
      if (keyInfo) {
        arh.appendItem(nodeId, new Rec(keyInfo, 'masterpublickey', null));
      }
    }
    this.log.debug('internal state %o', arh);
    const ar = arh.group(quorumNodeCount);
    this.log.debug('result %o', ar);
    return ar
  }

  /*
  Queries S and A nodes via push_getTransactions()
  Merges the replies.

  Algo:


  every account (accountInCaip) can be mapped to a shard
  accountInCaip -> shard1 ;

  for every shard1  we will pick
  1) snodes that will host shard1
  2) anodes (all)

  let's assume that we have
  3 anodes: a1-a3
  10 snodes: s1-s10

  if numOfNodesToRead = 51% * ( count(snodes for) + count(anodes)) = 13 * 0.51 = 7
  we need to pick 3 anodes, and 7-3 = 4 snodes = random_subset (s1..10)
   */
  async getTransactions(accountInCaip: string, category: string, ts: string, sortOrder: string) {
    Check.isTrue(ChainUtil.isFullCAIPAddress(accountInCaip), 'non-CAIP address' + accountInCaip);
    Check.isTrue(category == "INIT_DID" || category.startsWith('CUSTOM:'), 'unsupported category' + category);
    Check.isTrue(DateUtil.parseUnixFloatOrFail(ts) != null, 'unsupported timestamp');
    Check.isTrue(sortOrder == "ASC" || sortOrder == "DESC", 'unsupported category' + category);

    let aNodes = [...this.valContractState.getArchivalNodesMap().keys()];
    let aNodesToQuery = [];
    for (const nodeId of aNodes) {
      const nodeInfo = this.valContractState.getArchivalNodesMap().get(nodeId)
      Check.notNull(nodeInfo);
      if (StrUtil.isEmpty(nodeInfo.url)) {
        this.log.error(`node: ${nodeId} has no url in the database`);
        continue;
      }
      if (!ValidatorContractState.isEnabled(nodeInfo)) {
        continue;
      }
      aNodesToQuery.push(nodeId);
    }
    this.log.debug('affected anodes [%d]: %s', aNodesToQuery.length, StrUtil.fmt(aNodesToQuery));

    let shardId = BlockUtil.calculateAffectedShard(accountInCaip, this.storageContractState.shardCount);
    this.log.debug('accountInCaip: %s maps to shard: %s', accountInCaip, shardId);
    const sNodesPerShard = Array.from(this.storageContractState.getStorageNodesForShard(shardId));
    const sNodesActive = [];
    for (const nodeId of sNodesPerShard) {
      const nodeInfo = this.valContractState.getStorageNodesMap().get(nodeId)
      Check.notNull(nodeInfo);
      if (StrUtil.isEmpty(nodeInfo.url)) {
        this.log.error(`node: ${nodeId} has no url in the database`);
        continue;
      }
      if (!ValidatorContractState.isEnabled(nodeInfo)) {
        continue;
      }
      sNodesActive.push(nodeId);
    }
    // # of nodes required
    const totalNodeCnt = aNodesToQuery.length + sNodesActive.length;
    let nodesRequiredToPoll = Math.ceil(this.READ_QUORUM_PERC * totalNodeCnt);
    // # of nodes we will really poll
    let nodesToPoll = Math.min(nodesRequiredToPoll + this.READ_QUORUM_REDUNDANCY, totalNodeCnt);
    const sNodesToQueryCnt = nodesToPoll - aNodes.length;
    this.log.debug('nodesToPoll %d (nodesRequiredToPoll %d): %dxA ', nodesToPoll, nodesRequiredToPoll, aNodesToQuery.length);
    Check.isTrue(sNodesToQueryCnt <= sNodesActive.length, 'invalid sNodesToQueryCnt');

    let sNodesToQuery = RandomUtil.getRandomSubArray(sNodesActive, sNodesToQueryCnt);
    this.log.debug('affected snodes [%d]: %s', sNodesToQuery.length, StrUtil.fmt(sNodesToQuery));
    this.log.debug('nodesToPoll %d (nodesRequiredToPoll %d): %dxA , %dxS ', nodesToPoll, this.READ_QUORUM_PERC, aNodesToQuery.length, sNodesToQuery.length);

    // query aNodesToQuery + sNodesToQuery
    const nodeQueryPlan:{ nodeId: string, isANode: boolean}[] = [];
    for (const nodeId of aNodesToQuery) {
      nodeQueryPlan.push({ nodeId: nodeId, isANode: true});
    }
    for (const nodeId of sNodesToQuery) {
      nodeQueryPlan.push({ nodeId: nodeId, isANode: false});
    }
    const promiseList: Promise<Tuple<TxInfo[], RpcError>>[] = [];
    for (const query of nodeQueryPlan) {
      if(query.isANode) {
        this.log.debug('query to anode %s', query.nodeId);
        const nodeBaseUrl = this.valContractState.getArchivalNodesMap().get(query.nodeId)?.url;
        const client = new ArchivalClient(nodeBaseUrl);
        promiseList.push(client.push_getTransactions(accountInCaip, category, ts, sortOrder));
      } else {
        this.log.debug('query to snode %s', query.nodeId);
        const nodeBaseUrl = this.valContractState.getStorageNodesMap().get(query.nodeId)?.url;
        const client = new StorageClient(nodeBaseUrl);
        promiseList.push(client.push_getTransactions(accountInCaip, category, ts, sortOrder));
      }
    }

    // await them
    const prList = await PromiseUtil.allSettled(promiseList);

    // handle replies
    const merger = new ReplyMerger();
    for (let i = 0; i < nodeQueryPlan.length; i++) {
      const query = nodeQueryPlan[i]
      const nodeId = query.nodeId;
      const pr = prList[i];
      if (pr.isRejected()) {
        merger.appendHttpCode(nodeId, NodeHttpStatus.REPLY_TIMEOUT);
        continue;
      }
      let [txArr, err] = pr.val;
      if (err != null) {
        this.log.error('error from node: %s message: %o', nodeId, err);
        merger.appendHttpCode(nodeId, 500);
        continue;
      }
      merger.appendHttpCode(nodeId, 200);
      if (txArr) {
        for (const txInfo of txArr) {
          merger.appendItem(nodeId, new Rec(txInfo, "hash", "ts"));
        }
      }
    }
    this.log.debug('internal state %o', merger);
    const ar = merger.group(nodesRequiredToPoll);
    this.log.debug('result %o', ar);
    return ar
  }

  async getTransactionStatus() {

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

export enum NodeSendResult {
  SENT,
  ERROR_CAN_RETRY,
  DO_NOT_RETRY
}


