import * as cbor from 'cbor'
import { CID, IPFSHTTPClient } from 'ipfs-http-client'
import { base32 } from 'multiformats/bases/base32'
import { sha256 } from 'multiformats/hashes/sha2'
import { Container } from 'typedi'

import { Message } from '../../interfaces/chat'

/**
 *  Create a IPFS CID from a message object
 * @param message message object
 * @returns cid string of the message
 */
export async function createCID(message: Message): Promise<string> {
  const cid = CID.createV1(113, await sha256.digest(cbor.encodeCanonical(message)))
  return cid.toString()
}

/**
 *  Create a IPFS CID from a string
 * @param file file for which CID needs to be created
 * @returns cid string of the file
 */
export async function createFileCID(file: any): Promise<string> {
  const cid = CID.createV1(0x55, await sha256.digest(cbor.encodeCanonical(file)))
  return cid.toString(base32)
}

/**
 * Upload a message object to IPFS and pin it
 * @param message message object
 * @dev - This fn uses dag which has a 1MB limit. If the message is bigger than 1MB, it will throw an error
 */
export async function uploadMessageToIPFS(message: Message): Promise<CID> {
  const ipfs: IPFSHTTPClient = Container.get('ipfs')
  const cid = await ipfs.dag.put(message, { pin: true })
  return cid
}

export async function getMessageFromIPFS(cid: string): Promise<any> {
  try {
    const ipfs: IPFSHTTPClient = Container.get('ipfs')
    const cidObject: CID = CID.parse(cid)
    return (await ipfs.dag.get(cidObject, { timeout: 5000 })).value
  } catch (error) {
    return null
  }
}

/**
 * Unpin a message from IPFS
 * @param cid cid of the message
 */
export async function unpinMessages(cid: CID): Promise<void> {
  const ipfs: IPFSHTTPClient = Container.get('ipfs')
  const unpinnedCid = await ipfs.pin.rm(cid)
  // We need the for loop to run the garbage collector.
  // In the ipfs documentation is like this
  for await (const chunk of ipfs.repo.gc()) {
  }
}

/**
 * Upload a file to IPFS and pin it
 * @param file file to be uploaded to IPFS
 * @returns cid and size of the file
 * @dev - This fn is used for uploading images in Push Chat. ( Used by Push Dapp )
 */
export async function uploadToIPFS(file: any): Promise<{ cid: CID; size: number }> {
  const ipfs: IPFSHTTPClient = Container.get('ipfs')
  const cid = await ipfs.add(file, { pin: true })
  return { cid: cid.cid, size: cid.size }
}
