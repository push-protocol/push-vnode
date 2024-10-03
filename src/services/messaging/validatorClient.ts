import axios from 'axios'
import { AddPayloadRequest } from './msgConverterService'
import { PingReply } from './validatorPing'
import { NodeRandom } from './validatorRandom'
import { MessageBlock, MessageBlockSignatures } from '../messaging-common/messageBlock'
import { Logger } from 'winston'
import { WinstonUtil } from '../../utilz/winstonUtil'
import { AttestBlockResult, AttestSignaturesResult } from './validatorNode'
import {AttestorReply} from "../../generated/push/block_pb";
import {BitUtil} from "../../utilz/bitUtil";
import {UrlUtil} from "../../utilz/urlUtil";

/*
External validator/attester api.
*/
export class ValidatorClient {
  public log: Logger = WinstonUtil.newLog(ValidatorClient)
  baseUri: string;
  baseRpcUri : string;
  timeout: number = 500000;
  requestCounter: number = 1;

  constructor(baseUri: string) {
    this.baseUri = UrlUtil.append(baseUri, '/api/v1');
    this.baseRpcUri = UrlUtil.append(baseUri, '/api/v1/rpc');
    this.log.level = 'error';
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


  public async v_attestBlock(blockRaw: Uint8Array): Promise<AttestorReply | null> {
    const url = this.baseRpcUri;
    const requestId = this.requestCounter++;
    const req =
      {
        "jsonrpc": "2.0",
        "method": "v_attestBlock",
        "params": [`${BitUtil.bytesToBase16(blockRaw)}`],
        "id": requestId
      }
    const resp = await axios.post(url, req, {timeout: this.timeout})
    if (resp.status != 200) {
      this.log.debug(`error status: ${resp.status} data: ${resp.data}`)
      return null
    }
    this.log.debug('attest %s returned %s, data: %s', url, resp.status, resp.data)
    let resultField = resp.data?.result;
    if (resultField == null) {
      return null;
    }
    let ar = AttestorReply.deserializeBinary(BitUtil.base16ToBytes(resultField));
    return ar;
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
