import { BytesLike, ethers, Wallet } from 'ethers'
import { verifyMessage } from 'ethers/lib/utils'
import { ObjectHasher } from './objectHasher'

/**
 * Utitily class that allows
 * - to sign objects with an eth private key
 * - to check that signature later
 *
 * Ignores 'signature' properties
 */
export class EthSig {
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
}

export function Signed(target: Function) {}
