import axios from 'axios'
import {PingReply} from './validatorPing'
import {NodeRandom} from './validatorRandom'
import {Logger} from 'winston'
import {WinstonUtil} from '../../utilz/winstonUtil'
import {BitUtil} from "../../utilz/bitUtil";
import {UrlUtil} from "../../utilz/urlUtil";
import {AttestBlockResult, AttestSignaturesRequest, AttestSignaturesResponse} from "../../generated/push/block_pb";
import {JsonRpcClient, RpcError} from "../../utilz/jsonRpcClient";
import {Tuple} from "../../utilz/tuple";
import {EnvLoader} from "../../utilz/envLoader";

/*
External validator/attester api.
*/
export class ValidatorClient {
  public log: Logger = WinstonUtil.newLog(ValidatorClient);
  baseUri: string;
  timeout: number = EnvLoader.getPropertyAsNumber("VALIDATOR_CLIENT_TIMEOUT", 60000);
  private rpc: JsonRpcClient;

  constructor(baseUri: string) {
    this.baseUri = UrlUtil.append(baseUri, '/api/v1');
    let baseRpcUri = UrlUtil.append(baseUri, '/api/v1/rpc');
    this.rpc = new JsonRpcClient(this.timeout, baseRpcUri);
  }

  public async v_attestBlock(blockRaw: Uint8Array): Promise<Tuple<AttestBlockResult, RpcError>> {
    return await this.rpc.call(
      "v_attestBlock",
      [BitUtil.bytesToBase16(blockRaw)],
      (data: any): AttestBlockResult => AttestBlockResult.deserializeBinary(BitUtil.base16ToBytes(data)));
  }


  async v_attestSignatures(asr: AttestSignaturesRequest): Promise<Tuple<AttestSignaturesResponse, RpcError>> {
    return await this.rpc.call(
      "v_attestSignatures",
      [BitUtil.bytesToBase16(asr.serializeBinary())],
      (data: any): AttestSignaturesResponse => {
        return data == null
          ? null : AttestSignaturesResponse.deserializeBinary(BitUtil.base16ToBytes(data));
      });
  }

  // todo replace with json rpc
  async ping(): Promise<PingReply | null> {
    const url = `${this.baseUri}/messaging/ping`
    const resp = await axios.get(url, { timeout: 5000 }).catch(() => null)
    if (resp.status != 200) {
      this.log.debug(`error status: ${resp.status} data: ${resp.data}`)
      return null
    }
    return resp.data
  }

  // todo replace with json rpc
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


