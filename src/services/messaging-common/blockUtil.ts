import {
  AttestBlockResult,
  Block,
  InitDid,
  Signer,
  Transaction,
  TxAttestorData,
  TxValidatorData,
  Vote
} from "../../generated/push/block_pb";
import {EnvLoader} from "../../utilz/envLoader";
import {HashUtil} from "../../utilz/hashUtil";
import {BitUtil} from "../../utilz/bitUtil";
import StrUtil from "../../utilz/strUtil";
import {EthUtil} from "../../utilz/EthUtil";
import {Check} from "../../utilz/check";
import {NumUtil} from "../../utilz/numUtil";
import {EthSig} from "../../utilz/ethSig";
import {Logger} from "winston";
import {WinstonUtil} from "../../utilz/winstonUtil";
import DateUtil from "../../utilz/dateUtil";
import {Wallet} from "ethers";
import {ArrayUtil} from "../../utilz/arrayUtil";


export class BlockUtil {
  public static readonly log: Logger = WinstonUtil.newLog(BlockUtil);

  // max serialized tx size
  public static readonly MAX_TRANSACTION_SIZE_BYTES = EnvLoader.getPropertyAsNumber('MAX_TRANSACTION_SIZE_BYTES', 1000000);
  // max total tx data in a block ,
  // when reached block would stop accepting transactions
  public static readonly MAX_TOTAL_TRANSACTION_SIZE_BYTES = EnvLoader.getPropertyAsNumber('MAX_TOTAL_TRANSACTION_SIZE_BYTES', 10 * 1000000);

  // max total tx count
  // when reached block would stop accepting transactions
  public static readonly MAX_TRANSACTIONS_PER_BLOCK = EnvLoader.getPropertyAsNumber('MAX_TRANSACTION_PER_BLOCK', 1000);

  // blocks older than this would get rejected by attestors
  // note: attestor should have an up-to-date clock time for this (!)
  public static ATTESTOR_MAX_BLOCK_AGE_SECONDS = EnvLoader.getPropertyAsNumber('MAX_BLOCK_AGE_SECONDS', 120);

  // we will cache incomplete blocks for this amount of seconds
  // attestSignatures will stop working after this time
  public static readonly MAX_BLOCK_ASSEMBLY_TIME_SECONDS = EnvLoader.getPropertyAsNumber('MAX_BLOCK_ASSEMBLY_TIME_SECONDS', 60);

  public static readonly VALID_VALIDATOR_VOTES: Set<number> = new Set<number>([1]);
  public static readonly VALID_ATTESTOR_VOTES: Set<number> = new Set<number>([1, 2]);

  public static parseTransaction(txRaw: Uint8Array): Transaction {
    if (txRaw == null || txRaw.length > BlockUtil.MAX_TRANSACTION_SIZE_BYTES) {
      throw new Error('tx size is too big');
    }
    const tx = Transaction.deserializeBinary(txRaw);
    return tx;
  }

  public static parseBlock(bRaw: Uint8Array): Block {
    const b = Block.deserializeBinary(bRaw);
    return b;
  }

  public static hashTransactionAsHex(txRaw: Uint8Array): string {
    return BitUtil.bytesToBase16(BlockUtil.hashTransaction(txRaw));
  }

  private static hashTransaction(txRaw: Uint8Array) {
    return HashUtil.sha256AsBytes(txRaw);
  }

  public static hashBlockAsHex(blockRaw: Uint8Array): string {
    return BitUtil.bytesToBase16(HashUtil.sha256AsBytes(blockRaw));
  }

  // when the block has not been signed, we still need a valid immutable hash based on tx data
  // this is used to cache the block contents
  // Deprecated
  public static hashBlockIncomplete(blockObj: Block): string {
    let txHashes: Uint8Array[] = [];
    for (let txObj of blockObj.getTxobjList()) {
      let tx = txObj.getTx();
      let txHash = BlockUtil.hashTransaction(tx.serializeBinary());
      txHashes.push(txHash);
    }
    return BitUtil.bytesToBase16(HashUtil.sha256ArrayAsBytes(txHashes));
  }

  public static blockToJson(block: Block) {
    return JSON.stringify(block.toObject());
  }

  public static transactionToJson(tx: Transaction) {
    return JSON.stringify(tx.toObject());
  }

  public static blockToBase16(block: Block) {
    return BitUtil.bytesToBase16(block.serializeBinary());
  }

  public static transactionToBase16(tx: Transaction) {
    return BitUtil.bytesToBase16(tx.serializeBinary());
  }

  // 1) try to get first byte from caip address
  // eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681 -> d8 -> 216
  // and use it as shard
  // 2) take sha256(addr) ->
  // shard count is a smart contract constant; normally it should never change
  // lets read this value from a contract
  public static calculateAffectedShard(wallet: string, shardCount: number): number | null {
    if (StrUtil.isEmpty(wallet)) {
      return null
    }
    let shardId: number = null
    const res = EthUtil.parseCaipAddress(wallet);
    if (res[1] != null) {
      throw new Error('invalid caip address:' + res[1]);
    }
    const addrObj = res[0];
    if (
      addrObj != null &&
      !StrUtil.isEmpty(addrObj.addr) &&
      addrObj.addr.startsWith('0x') &&
      addrObj.addr.length > 4
    ) {
      const firstByteAsHex = addrObj.addr.substring(2, 4).toLowerCase()
      shardId = Number.parseInt(firstByteAsHex, 16)
    }
    // 2) try to get sha256 otherwise
    if (shardId == null) {
      let walletBytes = BitUtil.stringToBytesUtf(wallet);
      let hashBase16 = BitUtil.bytesToBase16(HashUtil.sha256AsBytes(walletBytes));
      Check.isTrue(hashBase16.length >= 2, "hash is too short");
      const firstByteAsHex = hashBase16.toLowerCase().substring(0, 2);
      shardId = Number.parseInt(firstByteAsHex, 16);
    }
    Check.notNull(shardId)
    Check.isTrue(shardId >= 0 && shardId <= 255 && NumUtil.isRoundedInteger(shardId))
    Check.isTrue(shardCount >= 1)
    return shardId % shardCount
  }

  /**
   * Evaluates all messageBlock target recipients (normally these are addresses)
   * for every included packet
   *
   * And for every recipient finds which shard will host this address
   *
   * @param block
   * @param shardCount total amount of shards; see smart contract for this value
   * @returns a set of shard ids
   */
  static calculateAffectedShards(block: Block, shardCount: number): Set<number> {
    const shards = new Set<number>()
    for (const txObj of block.getTxobjList()) {
      let senderAndRecipients = [txObj.getTx().getSender(), ...txObj.getTx().getRecipientsList()];
      for (const wallet of senderAndRecipients) {
        const shardId = this.calculateAffectedShard(wallet, shardCount)
        if (shardId == null) {
          continue
        }
        shards.add(shardId);
      }
    }
    return shards
  }


  public static async checkGenericTransaction(tx: Transaction): Promise<CheckResult> {
    if (tx.getType() != 0) {
      CheckResult.failWithText(`Only non-value transactions are supported`);
    }
    if (!EthUtil.isFullCAIPAddress(tx.getSender())) {
      CheckResult.failWithText(`sender ${tx.getSender()} is not in full CAIP format ${tx.getSender()}`);
    }
    for (const recipientAddr of tx.getRecipientsList()) {
      if (!EthUtil.isFullCAIPAddress(recipientAddr)) {
        CheckResult.failWithText(`recipient ${recipientAddr} is not in full CAIP format ${tx.getSender()}`);
      }
    }

    if (StrUtil.isEmpty(BitUtil.bytesToBase16(tx.getSalt_asU8()))) {
      CheckResult.failWithText(`salt field is invalid`);
    }

    let validSignature = true; // todo check signature
    if (!validSignature) {
      CheckResult.failWithText(`signature field is invalid`);
    }
    return CheckResult.ok();
  }


  public static async checkTransactionPayload(tx: Transaction): Promise<CheckResult> {
    if (tx.getCategory() === 'INIT_DID') {
      let txData = InitDid.deserializeBinary(tx.getData_asU8());
      if (StrUtil.isEmpty(txData.getMasterpubkey())) {
        CheckResult.failWithText(`masterPubKey missing`);
      }
      if (StrUtil.isEmpty(txData.getDerivedpubkey())) {
        CheckResult.failWithText(`derivedPubKey missing`);
      }
      if (txData.getWallettoencderivedkeyMap().size < 1) {
        CheckResult.failWithText(`encDerivedPrivKey missing`);
      }
    } else if (tx.getCategory().startsWith("CUSTOM:")) {
      // no checks for user-defined transactions
    } else {
      CheckResult.failWithText(`unsupported transaction category`);
    }
    return CheckResult.ok();
  }


  // for tests
  public static async signBlockAsValidator(wallet: Wallet, blockNoSigs: Block) {
    Check.isTrue(blockNoSigs.getSignersList().length == 0);
    for (let txObj of blockNoSigs.getTxobjList()) {
      let voteObj = new TxValidatorData();
      voteObj.setVote(Vote.ACCEPTED);
      txObj.setValidatordata(voteObj);
      txObj.clearAttestordataList();
    }
    const ethSig = await EthSig.signBytes(wallet, blockNoSigs.serializeBinary());
    let vSign = new Signer();
    vSign.setSig(ethSig);
    blockNoSigs.setSignersList([vSign]);
  }

  // for tests
  public static async signBlockAsAttestor(wallet: Wallet, blockSignedByV: Block): Promise<AttestBlockResult> {
    let tmpBlock = Block.deserializeBinary(blockSignedByV.serializeBinary());
    Check.isTrue(blockSignedByV.getSignersList().length == 1);
    // tmp block with vsig + attestor data gets signed
    let ar = new AttestBlockResult();
    for (let txObj of tmpBlock.getTxobjList()) {
      let attestorData = new TxAttestorData();
      attestorData.setVote(Vote.ACCEPTED);

      ar.getAttestordataList().push(attestorData);
      txObj.setAttestordataList([attestorData]);
    }

    const ethSig = await EthSig.signBytes(wallet, tmpBlock.serializeBinary());

    // embed attestor data and signature into real object
    let aSign = new Signer();
    aSign.setSig(ethSig);
    ar.setSigner(aSign);
    return ar;
  }

  // for tests
  public static async appendPatchAsValidator(wallet: Wallet, blockSignedByVA: Block, ar: AttestBlockResult): Promise<void> {
    for (let txIndex = 0; txIndex < blockSignedByVA.getTxobjList().length; txIndex++) {
      let attestDataPerTx = ar.getAttestordataList()[txIndex];
      blockSignedByVA.getTxobjList()[txIndex].getAttestordataList().push(attestDataPerTx);
    }
    blockSignedByVA.getSignersList().push(ar.getSigner());
  }

  public static async recoverPatchAddress(wallet: Wallet, blockSignedByVA: Readonly<Block>, ar: AttestBlockResult): Promise<string> {
    let tmpBlock = Block.deserializeBinary(blockSignedByVA.serializeBinary());
    // tx0 -> attest0, ...
    // is restructured into
    // block.txObj[0].tx -> attest0, ...
    for (let txIndex = 0; txIndex < tmpBlock.getTxobjList().length; txIndex++) {
      let attestDataPerTx = ar.getAttestordataList()[txIndex];
      tmpBlock.getTxobjList()[txIndex].setAttestordataList([attestDataPerTx]);
    }

    let aSignatureBytes = ar.getSigner().getSig_asU8();
    let tmpBlockBytes = tmpBlock.serializeBinary();
    this.log.debug('recovery pub key from block with hash: %s', EthSig.ethHash(tmpBlockBytes));
    const attestorNodeId = EthSig.recoverAddressFromMsg(tmpBlockBytes, aSignatureBytes);
    this.log.debug('attestorNodeId %o', attestorNodeId);
    return attestorNodeId;
  }

  public static async recoverSignerAddress(blockSignedByVA: Readonly<Block>, signerIndex: number): Promise<string> {
    Check.isTrue(signerIndex >= 0 && signerIndex < blockSignedByVA.getSignersList().length, 'signer out of index');
    if (signerIndex == 0) {
      // validator
      const validatorSignature = blockSignedByVA.getSignersList()[0]?.getSig_asU8();
      Check.notNull(validatorSignature, "validator signature is required");
      let tmpBlock = Block.deserializeBinary(blockSignedByVA.serializeBinary());
      tmpBlock.clearSignersList();
      for (const txObj of tmpBlock.getTxobjList()) {
        txObj.clearAttestordataList();
      }
      let blockBytesNoSigners = tmpBlock.serializeBinary();
      const blockValidatorNodeId = EthSig.recoverAddressFromMsg(blockBytesNoSigners, validatorSignature);
      BlockUtil.log.debug('signature # %s by %s (validator) ', 0, blockValidatorNodeId);
      return blockValidatorNodeId;
    } else {
      let tmpBlock = Block.deserializeBinary(blockSignedByVA.serializeBinary());
      let onlyVSignature = [blockSignedByVA.getSignersList()[0]];
      tmpBlock.setSignersList(onlyVSignature);
      for (let txIndex = 0; txIndex < tmpBlock.getTxobjList().length; txIndex++) {
        const txObj = tmpBlock.getTxobjList()[txIndex];
        let onlyOneAttestation = blockSignedByVA.getTxobjList()[txIndex].getAttestordataList()[signerIndex - 1];
        txObj.setAttestordataList([onlyOneAttestation]);
      }

      let blockBytesNoSignersAnd1Attest = tmpBlock.serializeBinary();
      let attSignature = blockSignedByVA.getSignersList()[signerIndex].getSig_asU8();
      const attNodeId = EthSig.recoverAddressFromMsg(blockBytesNoSignersAnd1Attest, attSignature);
      BlockUtil.log.debug('signature # %s by %s ', signerIndex - 1, attNodeId);
      return attNodeId;
    }
  }

  public static async checkBlockAsAttestor(blockSignedByV: Block, validatorsFromContract: Set<string>): Promise<CheckResult> {
    if (blockSignedByV.getTxobjList().length >= BlockUtil.MAX_TRANSACTIONS_PER_BLOCK) {
      return CheckResult.failWithText(
        `block is full; tx count: ${blockSignedByV.getTxobjList().length} ; limit: ${BlockUtil.MAX_TRANSACTIONS_PER_BLOCK} `);
    }
    if (BlockUtil.ATTESTOR_MAX_BLOCK_AGE_SECONDS != null &&
      BlockUtil.ATTESTOR_MAX_BLOCK_AGE_SECONDS > 0 &&
      Math.abs(blockSignedByV.getTs() - DateUtil.currentTimeMillis()) > 1000 * BlockUtil.ATTESTOR_MAX_BLOCK_AGE_SECONDS) {
      return CheckResult.failWithText(`block is too old: ${blockSignedByV.getTs()}`);
    }
    if (!ArrayUtil.hasMinSize(blockSignedByV.getAttesttoken_asU8(), 4)) {
      return CheckResult.failWithText('attest token is missing or too small (4bytes min)');
    }
    // all tx should be valid
    let totalTxBytes = 0;
    for (let i = 0; i < blockSignedByV.getTxobjList().length; i++) {
      const txObj = blockSignedByV.getTxobjList()[i];
      let tx = txObj.getTx();
      if (tx == null) {
        return CheckResult.failWithText('empty transaction found!');
      }
      const txBytes = tx.serializeBinary().length;
      totalTxBytes += txBytes;
      if (txBytes > BlockUtil.MAX_TRANSACTION_SIZE_BYTES) {
        return CheckResult.failWithText(
          `transaction size exceeds the limit: ${txBytes} ; limit: ${BlockUtil.MAX_TRANSACTION_SIZE_BYTES}`);
      }
      if (txObj.getValidatordata() == null || !BlockUtil.VALID_VALIDATOR_VOTES.has(txObj.getValidatordata().getVote())) {
        return CheckResult.failWithText(`tx # ${i} has invalid validator data`);
      }
      let check1 = await BlockUtil.checkGenericTransaction(tx);
      if (!check1.success) {
        return check1;
      }
      let check2 = await BlockUtil.checkTransactionPayload(tx);
      if (!check2.success) {
        return check2;
      }
    }
    if (totalTxBytes > BlockUtil.MAX_TOTAL_TRANSACTION_SIZE_BYTES) {
      return CheckResult.failWithText(
        `total transaction size exceeds the limit: ${totalTxBytes} ; limit: ${BlockUtil.MAX_TOTAL_TRANSACTION_SIZE_BYTES}`);
    }
    // number of signatures should be equal to number of attestations
    if (blockSignedByV.getSignersList().length == 0) {
      return CheckResult.failWithText(`at least validator signature is required`);
    }
    const sigCount = blockSignedByV.getSignersList().length;
    for (const txObj of blockSignedByV.getTxobjList()) {
      if (txObj.getAttestordataList().length != sigCount - 1) {
        return CheckResult.failWithText(
          `number of tx attestations (salt=${txObj.getTx().getSalt()}) does not match with signature count`);
      }
    }
    // do a v signature check
    const blockValidatorNodeId = await BlockUtil.recoverSignerAddress(blockSignedByV, 0);
    BlockUtil.log.debug('signature # %s by %s (validator) ', 0, blockValidatorNodeId);
    const allowed = validatorsFromContract.has(blockValidatorNodeId);
    Check.isTrue(allowed, `unregistered validator: ${blockValidatorNodeId}`);
    return CheckResult.ok();
  }

  public static async checkBlockFinalized(blockSignedByVA: Block,
                                          validatorsFromContract: Set<string>,
                                          valPerBlockFromContract: number) {
    let check1 = await BlockUtil.checkBlockAsAttestor(blockSignedByVA, validatorsFromContract);
    if (!check1.success) {
      return check1;
    }
    const sigCount = blockSignedByVA.getSignersList().length;
    if (sigCount != valPerBlockFromContract) {
      return CheckResult.failWithText(`block has only ${sigCount} signatures; expected ${valPerBlockFromContract} signatures `);
    }
    for (const txObj of blockSignedByVA.getTxobjList()) {
      if (txObj.getAttestordataList().length != sigCount - 1) {
        return CheckResult.failWithText(
          `number of tx attestations (salt=${txObj.getTx().getSalt()}) does not match with signature count`);
      }
    }

    let attestorCount = sigCount - 1;
    for (let txIndex = 0; txIndex < blockSignedByVA.getTxobjList().length; txIndex++) {
      const txObj = blockSignedByVA.getTxobjList()[txIndex];
      let tx = txObj.getTx();
      if (tx == null) {
        return CheckResult.failWithText('empty transaction found!');
      }
      if (txObj.getAttestordataList() == null || txObj.getAttestordataList().length != attestorCount) {
        return CheckResult.failWithText(
          `tx # ${txIndex} has invalid number of attestations; ${txObj.getAttestordataList().length} instead of ${attestorCount}`);
      }
      for (const txAttData of txObj.getAttestordataList()) {
        if (txAttData == null || !BlockUtil.VALID_ATTESTOR_VOTES.has(txAttData.getVote())) {
          return CheckResult.failWithText(`tx # ${txIndex} has invalid attestor data`);
        }
      }
    }

    // do A signature check
    // this requires clearing all signatures + all attestor data except the current one
    let tmpBlock = Block.deserializeBinary(blockSignedByVA.serializeBinary());
    let onlyVSignature = [blockSignedByVA.getSignersList()[0]];
    tmpBlock.setSignersList(onlyVSignature);
    for (let attIndex = 1; attIndex < sigCount; attIndex++) {
      const attNodeId = await BlockUtil.recoverSignerAddress(blockSignedByVA, attIndex);
      BlockUtil.log.debug('signature # %s by %s ', attIndex - 1, attNodeId);
      const allowed = validatorsFromContract.has(attNodeId)
      Check.isTrue(allowed, `unregistered validator_: ${attNodeId}`)
      // check attestation token
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
    }
    return CheckResult.ok();
  }
}


export class CheckResult {
  success: boolean
  err: string

  static failWithText(err: string): CheckResult {
    return {success: false, err: err}
  }

  static ok(): CheckResult {
    return {success: true, err: ''}
  }
}