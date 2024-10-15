import nacl from "tweetnacl";
import {hashMessage} from "@ethersproject/hash";
import {Wallet} from "ethers";
import {Check} from "./check";
import {BitUtil} from "./bitUtil";

export class SolUtil {

  public static signBytes(walletPrivKey: Uint8Array, msgBytes: Uint8Array): Uint8Array {
    const signature = nacl.sign.detached(msgBytes, walletPrivKey);
    Check.isTrue(signature != null && signature.length > 0);
    return signature;
  }

  public static checkSignature(walletPubKey: Uint8Array, msgBytes: Uint8Array, signature: Uint8Array): boolean {
    const result = nacl.sign.detached.verify(
      msgBytes,
      signature,
      walletPubKey,
    );
    return result;
  }

  public static convertAddrToBytes(solAddress: string): Uint8Array {
    return BitUtil.base58ToBytes(solAddress);
  }
}