import {Block, InitDid, Transaction} from "../../generated/push/block_pb";
import {EnvLoader} from "../../utilz/envLoader";
import {HashUtil} from "../../utilz/hashUtil";
import {BitUtil} from "../../utilz/bitUtil";
import {Wallet} from "ethers";
import {MessageBlock} from "./messageBlock";
import StrUtil from "../../utilz/strUtil";
import {EthUtil} from "../../utilz/EthUtil";
import {ObjectHasher} from "../../utilz/objectHasher";
import {Check} from "../../utilz/check";
import {NumUtil} from "../../utilz/numUtil";
import {TransactionError} from "../messaging/transactionError";

export class BlockUtil {
  public static readonly MAX_TRANSACTION_SIZE_BYTES = EnvLoader.getPropertyAsNumber('MAX_TRANSACTION_SIZE_BYTES', 1000000);
  public static readonly MAX_TOTAL_TRANSACTION_SIZE_BYTES = EnvLoader.getPropertyAsNumber('MAX_TRANSACTION_SIZE_BYTES', 10 * 1000000);
  public static readonly MAX_TRANSACTIONS_PER_BLOCK = EnvLoader.getPropertyAsNumber('MAX_TRANSACTION_PER_BLOCK', 1000);

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

  public static calculateTransactionHashBase16(txRaw: Uint8Array): string {
    return BitUtil.bytesToBase16(HashUtil.sha256AsBytes(txRaw));
  }

  public static calculateBlockHashBase16(blockRaw: Uint8Array): string {
    return BitUtil.bytesToBase16(HashUtil.sha256AsBytes(blockRaw));
  }

  public static blockToJson(block:Block) {
    return JSON.stringify(block.toObject());
  }

  public static transactionToJson(tx:Transaction) {
    return JSON.stringify(tx.toObject());
  }

  public static blockToBase16(block:Block) {
    return BitUtil.bytesToBase16(block.serializeBinary());
  }

  public static transactionToBase16(tx:Transaction) {
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
    const addrObj = EthUtil.parseCaipAddress(wallet)
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
      const firstByteAsHex = ObjectHasher.hashToSha256(wallet).toLowerCase().substring(0, 2)
      shardId = Number.parseInt(firstByteAsHex, 16)
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


  public static async checkGenericTransaction(tx: Transaction):Promise<CheckResult> {
    if (tx.getType() != 0) {
      CheckResult.failWithText(`Only non-value transactions are supported`);
    }
    let senderAddr = EthUtil.parseCaipAddress(tx.getSender());
    let recipientAddrs = tx.getRecipientsList().map(value => EthUtil.parseCaipAddress(value));
    let goodSender = !StrUtil.isEmpty(senderAddr.chainId) && !StrUtil.isEmpty(senderAddr.namespace)
      && !StrUtil.isEmpty(senderAddr.addr);
    if (!goodSender) {
      CheckResult.failWithText(`sender field is invalid ${tx.getSender()}`);
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
      if (StrUtil.isEmpty(txData.getDid())) {
        CheckResult.failWithText(`did missing`);
      }
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



  public static async checkBlock(b:Block, validatorsFromContract: Set<string>): Promise<CheckResult> {

    // todo
    // check required block fields
    // check required tx fields
    // check known tx payload
    // check signers: they should be known from the set above
    return CheckResult.ok();
  }
}



export class CheckResult {
  success: boolean
  err: string

  static failWithText(err: string): CheckResult {
    return { success: false, err: err }
  }

  static ok(): CheckResult {
    return { success: true, err: '' }
  }
}