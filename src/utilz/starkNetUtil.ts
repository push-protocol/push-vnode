import {ec, hash, num, json, Contract, WeierstrassSignatureType, BigNumberish} from 'starknet';
import nacl from "tweetnacl";
import {Check} from "./check";
import {Keypair} from "@solana/web3.js";


export class StarkNetUtil {

  public static signBytes(walletPrivKey: Uint8Array, msgBytes: Uint8Array): Uint8Array {
    const convertedMsg: BigNumberish[] = Array.from(msgBytes);
    const msgHash = hash.computeHashOnElements(convertedMsg);
    const signature: WeierstrassSignatureType = ec.starkCurve.sign(msgHash, walletPrivKey);
    return signature.toCompactRawBytes();
  }

  public static checkSignature(walletPubKey: Uint8Array, msgBytes: Uint8Array, signature: Uint8Array): boolean {
    const convertedMsg: BigNumberish[] = Array.from(msgBytes);
    const msgHash = hash.computeHashOnElements(convertedMsg);
    const result = ec.starkCurve.verify(signature, msgHash, walletPubKey);
    console.log('Result (boolean) =', result);
    return result;
  }

  public static convertPrivKeyToPubKey(walletPrivateKey: Uint8Array): Uint8Array {
    return ec.starkCurve.getPublicKey(walletPrivateKey, false);
  }

}