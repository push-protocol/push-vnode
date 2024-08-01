import axios from 'axios'
import { AddPayloadRequest } from './msgConverterService'
import { PingReply } from './validatorPing'
import { NodeRandom } from './validatorRandom'
import { MessageBlock, MessageBlockSignatures } from '../messaging-common/messageBlock'
import { Logger } from 'winston'
import { WinstonUtil } from '../../utilz/winstonUtil'
import { AttestBlockResult, AttestSignaturesResult } from './validatorNode'

/*
External validator/attester api.
*/
export class ValidatorClient {
  public log: Logger = WinstonUtil.newLog(ValidatorClient)
  baseUri: string
  timeout: number = 500000

  constructor(baseUri: string) {
    this.baseUri = baseUri + '/apis/v1'
    this.log.level = 'error'
  }

  async addMessageAsync(data: AddPayloadRequest): Promise<boolean> {
    const url = `${this.baseUri}/messaging/addAsync`
    this.log.debug(`addMessage() ${url} ${data}`)
    const resp = await axios.post(url, data, { timeout: this.timeout })
    if (resp.status != 200) {
      this.log.debug(`error status: ${resp.status} data: ${resp.data}`)
      return false
    }
    this.log.debug(resp.status)
    return true
  }

  async addMessageBlocking(data: AddPayloadRequest): Promise<boolean> {
    const url = `${this.baseUri}/messaging/addBlocking`
    this.log.debug(`addMessage() ${url} ${data}`)
    const resp = await axios.post(url, data, { timeout: this.timeout })
    if (resp.status != 200) {
      this.log.debug(`error status: ${resp.status} data: ${resp.data}`)
      return false
    }
    this.log.debug(resp.status)
    return true
  }

  // for test
  async batchProcessBlock(): Promise<MessageBlock | null> {
    const url = `${this.baseUri}/messaging/batchProcessBlock`
    const resp = await axios.post(url, null, { timeout: this.timeout })
    if (resp.status != 200) {
      this.log.debug(`error status: ${resp.status} data: ${resp.data}`)
      return null
    }
    this.log.debug('batchProcessBlock %s %s %s', url, resp.status, resp.data)
    return resp.data
  }

  async attest(block: MessageBlock): Promise<AttestBlockResult | null> {
    const url = `${this.baseUri}/messaging/attest`
    const resp = await axios.post(url, block, { timeout: this.timeout })
    if (resp.status != 200) {
      this.log.debug(`error status: ${resp.status} data: ${resp.data}`)
      return null
    }
    this.log.debug('attest', url, resp.status, resp.data)
    return resp.data
  }

  async attestSignatures(blockSig: MessageBlockSignatures): Promise<AttestSignaturesResult> {
    const url = `${this.baseUri}/messaging/attestSignatures`
    const resp = await axios.post(url, blockSig, { timeout: this.timeout })
    if (resp.status != 200) {
      this.log.debug(`error status: ${resp.status} data: ${resp.data}`)
      return null
    }
    this.log.debug('attest %s %s %s', url, resp.status, resp.data)
    return resp.data
  }

  async ping(): Promise<PingReply | null> {
    const url = `${this.baseUri}/messaging/ping`
    const resp = await axios.get(url, { timeout: 5000 }).catch(() => null)
    if (resp.status != 200) {
      this.log.debug(`error status: ${resp.status} data: ${resp.data}`)
      return null
    }
    return resp.data
  }

  async random(): Promise<NodeRandom | null> {
    const url = `${this.baseUri}/messaging/random`
    const resp = await axios.get(url, { timeout: 5000 }).catch(() => null)
    if (resp?.status != 200) {
      this.log.debug(`error status: ${resp.status} data: ${resp.data}`)
      return null
    }
    return resp.data
  }
}
