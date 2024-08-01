import bent = require('bent')
import { create } from 'ipfs-http-client'
import * as IPFS from 'nano-ipfs-store'

import config from '../config/index'
import logger from '../loaders/logger'

let ipfsClient = null
let ipfs = null

export class IPFSClient {
  static init() {
    if (!ipfsClient) {
      ipfsClient = new IPFSClient()
      ipfs = IPFS.at(config.ipfsGateway)
    }
  }

  static async get(ipfsHash: string) {
    let jsonPayload = null
    const url = config.ipfsGateway + ipfsHash
    logger.info('Retrieving the content for url :: ' + url)
    const getJSON = bent('json')
    try {
      jsonPayload = await getJSON(url)
    } catch (err) {
      logger.error('Unable to fetch payload from IPFS: %o', err)
      throw err
    }
    return jsonPayload
  }

  static async getIcon(ipfsHash: string) {
    const url = config.ipfsGateway + ipfsHash
    let buffer = null
    logger.info('Retrieving the content for url :: ' + url)
    const getJSON = bent('buffer')
    try {
      buffer = await getJSON(url)
    } catch (err) {
      logger.error('Unable to fetch payload from IPFS: %o', err)
      throw err
    }
    return buffer
  }
}

const uploadToIfuraIpfs = async (input: string): Promise<string> => {
  const bufferInput = Buffer.from(input)
  const projectId: string = config.infuraIpfsProjectId
  const projectSecret: string = config.infuraIpfsProjectSecret
  const auth: string = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64')

  const client = create({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https',
    apiPath: '/api/v0',
    headers: {
      authorization: auth
    }
  })

  try {
    const storagePointer = await client.add(bufferInput, { pin: true })
    return storagePointer?.path
  } catch (err) {
    throw Error(err)
  }
}

export default {
  connect: IPFSClient.init,
  get: IPFSClient.get,
  uploadToIfuraIpfs: uploadToIfuraIpfs
}
