import axios, {AxiosError} from 'axios'
import {AddPayloadRequest} from './msgConverterService'
import {PingReply} from './validatorPing'
import {NodeRandom} from './validatorRandom'
import {MessageBlock, MessageBlockSignatures} from '../messaging-common/messageBlock'
import {Logger} from 'winston'
import {WinstonUtil} from '../../utilz/winstonUtil'
import {AttestSignaturesResult} from './validatorNode'
import {AttestBlockResult} from "../../generated/push/block_pb";
import {BitUtil} from "../../utilz/bitUtil";
import {UrlUtil} from "../../utilz/urlUtil";

/*
External validator/attester api.
*/
export class ValidatorClient {
  public log: Logger = WinstonUtil.newLog(ValidatorClient);
  baseUri: string;
  baseRpcUri : string;
  timeout: number = 500000;
  requestCounter: number = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER / 20);

  constructor(baseUri: string) {
    this.baseUri = UrlUtil.append(baseUri, '/api/v1');
    this.baseRpcUri = UrlUtil.append(baseUri, '/api/v1/rpc');
    this.log.level = 'error';
  }


  private async sendRpcRequest<T>(method: string, params: any[], deserializer: (data: any) => T): Promise<Tuple<T, RpcError>> {
    const url = this.baseRpcUri;
    const requestId = this.requestCounter++;
    const req = {
      jsonrpc: "2.0",
      method,
      params,
      id: requestId,
    };
    try {
      this.log.debug(`>> Calling RPC POST ${url} (req${requestId}) with body %o`, req);
      const resp = await axios.post(url, req, {timeout: this.timeout});
      this.log.debug(`<< RPC Reply POST ${url} (req${requestId}) code: ${resp.status} with body: %o`, resp.data);
      if (resp.status !== 200) {
        return [null, new RpcError(resp.data?.error?.code ?? resp.status, resp.data?.error?.message ?? 'Call error')];
      }
      const resultField = resp.data?.result;
      if (!resultField) {
        return [null, new RpcError(-1, 'Missing reply data')];
      }
      const result = deserializer(resultField);
      return [result, null];
    } catch (error) {
      this.log.debug(`Request failed: ${error}`);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        return [null, new RpcError(
          axiosError.response?.status ?? -1,
          axiosError.message
        )];
      }
      return [null, new RpcError(-1, 'Request failed')];
    }
  }

  public async v_attestBlock(blockRaw: Uint8Array): Promise<Tuple<AttestBlockResult, RpcError>> {
    const method = "v_attestBlock";
    const params = [BitUtil.bytesToBase16(blockRaw)];

    return await this.sendRpcRequest<AttestBlockResult>(method, params,
      (data: any): AttestBlockResult => AttestBlockResult.deserializeBinary(BitUtil.base16ToBytes(data)));
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
