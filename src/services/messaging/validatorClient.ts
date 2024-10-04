import axios, {AxiosError} from 'axios'
import {AddPayloadRequest} from './msgConverterService'
import {PingReply} from './validatorPing'
import {NodeRandom} from './validatorRandom'
import {MessageBlock, MessageBlockSignatures} from '../messaging-common/messageBlock'
import {Logger} from 'winston'
import {WinstonUtil} from '../../utilz/winstonUtil'
import {AttestSignaturesResult} from './validatorNode'
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



  /*

  Tuple<AttestorReply, RpcError> = [ar, err] , where only one of them is null

  so the best way is

  [ar, err] = call();
  if(err!=null) {
  handle err
  }
  handle happy path
   */
  public async v_attestBlock(blockRaw: Uint8Array): Promise<AttestorReply | RpcError> {
    const url = this.baseRpcUri;
    const requestId = this.requestCounter++;
    const method = "v_attestBlock";
    const params = [`${BitUtil.bytesToBase16(blockRaw)}`];
    const req =
      {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": requestId
      };
    try {
      //>> Calling GET /v1/messaging/ping {} with body: {}
      this.log.debug(`>> Calling RPC GET ${url} (req${requestId}) with body %o`, req);
      const resp = await axios.post(url, req, {timeout: this.timeout});
      if (resp.status !== 200) {
        // << Reply 200 with body: OK
        this.log.debug(`<< RPC Reply GET ${url} (req${requestId}) code: ${resp.status} with body: %o`, resp?.data);
        return new RpcError(resp.data?.error?.code ?? resp.status, resp.data?.error?.message ?? 'Call error');
      }
      this.log.debug(`<< RPC Reply GET ${url} (req${requestId}) code: ${resp.status} with body: %o`, resp?.data);
      const resultField = resp.data?.result;
      if (!resultField) {
        return new RpcError( -1, 'Missing reply data');
      }
      let reply = AttestorReply.deserializeBinary(BitUtil.base16ToBytes(resultField));
      return reply;
    } catch (error) {
      this.log.debug(`Request failed: ${error}`);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        return new RpcError(axiosError.response?.status ?? -1, axiosError.message);
      }
      return new RpcError( -1, 'Request failed');
    }
  }

  // todo remove
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

  // todo remove
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
  // todo remove
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


  // todo remove
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

  // todo replace
  async ping(): Promise<PingReply | null> {
    const url = `${this.baseUri}/messaging/ping`
    const resp = await axios.get(url, { timeout: 5000 }).catch(() => null)
    if (resp.status != 200) {
      this.log.debug(`error status: ${resp.status} data: ${resp.data}`)
      return null
    }
    return resp.data
  }

  // todo replace
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

export class RpcError {
  code: number;
  message: string;

  constructor(code: number, message: string) {
    this.code = code;
    this.message = message;
  }
}
