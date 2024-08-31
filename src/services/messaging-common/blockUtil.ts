import {Transaction} from "../../generated/push/block_pb";
import {EnvLoader} from "../../utilz/envLoader";
import {HashUtil} from "../../utilz/hashUtil";
import {BitUtil} from "../../utilz/bitUtil";

export class BlockUtil {
  public static readonly MAX_TRANSACTION_SIZE_BYTES = EnvLoader.getPropertyAsNumber('MAX_TRANSACTION_SIZE_BYTES', 1000000);

  public static parseTransaction(txRaw: Uint8Array): Transaction {
    if (txRaw == null || txRaw.length > BlockUtil.MAX_TRANSACTION_SIZE_BYTES) {
      throw new Error('tx size is too big');
    }
    const tx = Transaction.deserializeBinary(txRaw);
    return tx;
  }

  public static calculateTransactionHashBase16(txRaw: Uint8Array): string {
    return BitUtil.bytesToBase16(HashUtil.sha256AsBytes(txRaw));
  }

  public static calculateBlockHashBase16(blockRaw: Uint8Array): string {
    return BitUtil.bytesToBase16(HashUtil.sha256AsBytes(blockRaw));
  }
}