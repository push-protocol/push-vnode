import { BytesLike, ethers, Wallet } from 'ethers'
import { verifyMessage } from 'ethers/lib/utils'
import { ObjectHasher } from './objectHasher'
import {recoverAddress} from "@ethersproject/transactions";
import {hashMessage} from "@ethersproject/hash";
import {BitUtil} from "./bitUtil";
import {Check} from "./check";
import {Logger} from "winston";
import {WinstonUtil} from "./winstonUtil";

/**
 * Utitily class that allows
 * - to sign objects with an eth private key
 * - to check that signature later
 *
 * Ignores 'signature' properties
 */
export class EthUtil {
  public static log: Logger = WinstonUtil.newLog(EthUtil);

  // sign object
  public static async create(wallet: Wallet, ...objectsToHash: any[]): Promise<string> {
    const ethMessage = ObjectHasher.hashToSha256IgnoreSig(objectsToHash)
    const sig = await wallet.signMessage(ethMessage)
    return sig
  }

  // check object
  public static check(sig: string, targetWallet: string, ...objectsToHash: any[]): boolean {
    const ethMessage = ObjectHasher.hashToSha256IgnoreSig(objectsToHash)
    const verificationAddress = verifyMessage(ethMessage, sig)
    if (targetWallet !== verificationAddress) {
      return false
    }
    return true
  }

  public static isEthZero(addr: string) {
    return '0x0000000000000000000000000000000000000000' === addr
  }

  static getMessageHashAsInContract(message: string): string {
    return ethers.utils.keccak256(ethers.utils.arrayify(message))
  }

  static toBytes(value: BytesLike | number): Uint8Array {
    return ethers.utils.arrayify(value)
  }

  // simple sign with a private key
  static async signString(wallet: ethers.Signer, message: string): Promise<string> {
    return await wallet.signMessage(this.toBytes(message))
  }

  // simple check signature's public key (via address)
  public static async checkString(
    message: string,
    sig: string,
    targetWallet: string
  ): Promise<boolean> {
    const verificationAddress = verifyMessage(this.toBytes(message), sig)
    console.log('verification address:', verificationAddress)
    if (targetWallet !== verificationAddress) {
      return false
    }
    return true
  }

  // https://ethereum.org/es/developers/tutorials/eip-1271-smart-contract-signatures/
  // sign 'message hash'
  public static async signForContract(wallet: ethers.Signer, message: string): Promise<string> {
    const hash = this.getMessageHashAsInContract(message)
    return await wallet.signMessage(this.toBytes(hash))
  }

  // check 'message hash'
  public static async checkForContract(
    message: string,
    sig: string,
    targetWallet: string
  ): Promise<boolean> {
    const hash = this.getMessageHashAsInContract(message)
    const verificationAddress = verifyMessage(ethers.utils.arrayify(hash), sig)
    console.log('verification address:', verificationAddress)
    if (targetWallet !== verificationAddress) {
      return false
    }
    return true
  }

  // 0xAAAA == eip155:1:0xAAAAA
  public static recoverAddressFromMsg(message:Uint8Array, signature:Uint8Array):string {
    return recoverAddress(hashMessage(message), signature)
  }

  public static recoverAddress(hash:Uint8Array, signature:Uint8Array):string {
    return recoverAddress(hash, signature)
  }

  public static ethHash(message: Uint8Array) {
    return hashMessage(message);
  }

  public static async signBytes(wallet: Wallet, bytes: Uint8Array): Promise<Uint8Array> {
    const sig = await wallet.signMessage(bytes);
    Check.isTrue(sig.startsWith('0x'));
    let sigNoPrefix = sig.slice(2);
    let result = BitUtil.base16ToBytes(sigNoPrefix);
    Check.isTrue(result != null && result.length > 0);
    return result;
  }
}

export function Signed(target: Function) {}
