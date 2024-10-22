import {ethers} from "ethers";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {sha256} from '@noble/hashes/sha256';
import {CheckR} from "./blockUtil";
import {EthUtil} from "../../utilz/ethUtil";
import {Check} from "../../utilz/check";
import {BitUtil} from "../../utilz/bitUtil";
import {InitDid} from "../../generated/push/block_pb";
import {keccak256} from "ethereum-cryptography/keccak";

var util = require('util');


const hexes = /*#__PURE__*/ Array.from({length: 256}, (_v, i) =>
  i.toString(16).padStart(2, '0'),
)

// NO BACKEND DEPENDENCIES: THIS IS FRONT END LIB
export class PushNetUtil {

  public static toHex(value: Uint8Array): string {
    let string = ''
    for (let i = 0; i < value.length; i++) {
      string += hexes[value[i]]
    }
    const hex = `0x${string}` as const
    return hex
  }

  public static hex0xRemove(hexString: string) {
    if (hexString.length >= 2 && (hexString.startsWith('0x') || hexString.startsWith('0X'))) {
      hexString = hexString.substring(2);
    }
    if (hexString.length % 2 == 1) {
      hexString = '0' + hexString;
    }
    return hexString.toLowerCase();
  }

  public static messageBytesToHashBytes(payload: Uint8Array): Uint8Array {
    let txSha = sha256(payload); // raw bytes (non ascii)
    let hexedSha = this.toHex(txSha);
    const textSha = new util.TextEncoder().encode(hexedSha); // utf-8
    return textSha;
  }

  public static async checkPushInitSignature(masterPublicKeyUncompressed: Uint8Array, msgBytes: Uint8Array, sig: Uint8Array): Promise<SigCheck> {
    let hashBytes = this.messageBytesToHashBytes(msgBytes);
    let recoverAddrStr = ethers.utils.recoverAddress(hashBytes, sig).toLowerCase();
    const ethAddressFromPubKey = keccak256(masterPublicKeyUncompressed.slice(1)).slice(-20);
    const masterAddrStr = this.toHex(ethAddressFromPubKey).toLowerCase();
    if (recoverAddrStr !== masterAddrStr) {
      return SigCheck.failWithText(`masterPublicKey address ${masterAddrStr} differs from signature addr ${recoverAddrStr}`);
    }
    return SigCheck.ok();
  }

  public static async checkPushNetworkSignature(caipNamespace: string, caipChainId: string, caipAddr: string,
                                                msgBytes: Uint8Array, sig: Uint8Array): Promise<SigCheck> {
    let hashBytes = this.messageBytesToHashBytes(msgBytes);
    if (caipNamespace === 'eip155') {
      // EVM SIGNATURES
      const recoveredAddr = ethers.utils.recoverAddress(hashBytes, sig);
      const valid = recoveredAddr === caipAddr;
      if (!valid) {
        return SigCheck.failWithText(`sender address ${caipAddr} does not match recovered address ${recoveredAddr} signature was: ${sig}`);
      }
      return SigCheck.ok();
    } else if (caipNamespace === 'solana') {
      // SOLANA SIGNATURES
      const expectedPubKey = bs58.decode(caipAddr);
      const valid = nacl.sign.detached.verify(expectedPubKey, hashBytes, sig);
      if (!valid) {
        return SigCheck.failWithText(`sender address ${caipAddr} does not match with signature: ${sig}`);
      }
    } else {
      return SigCheck.failWithText(`unsupported chain id: ${caipNamespace}`);
    }
  }
}

export class SigCheck {
  success: boolean
  err: string

  static failWithText(err: string): SigCheck {
    return {success: false, err: err}
  }

  static ok(): SigCheck {
    return {success: true, err: ''}
  }
}