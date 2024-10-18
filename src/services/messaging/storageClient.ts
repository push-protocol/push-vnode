import axios, { AxiosResponse } from 'axios'
import { Logger } from 'winston'
import { WinstonUtil } from '../../utilz/winstonUtil'
import {JsonRpcClient, RpcError} from "../../utilz/jsonRpcClient";
import {UrlUtil} from "../../utilz/urlUtil";
import {AttestBlockResult} from "../../generated/push/block_pb";
import {BitUtil} from "../../utilz/bitUtil";
import {EnvLoader} from "../../utilz/envLoader";

export default class StorageClient {
  public log: Logger = WinstonUtil.newLog(StorageClient)
  public timeout: number = EnvLoader.getPropertyAsNumber("STORAGE_CLIENT_TIMEOUT", 5000);
  private rpc: JsonRpcClient;

  constructor(baseUri: string) {
    let baseRpcUri = UrlUtil.append(baseUri, '/api/v1/rpc');
    this.rpc = new JsonRpcClient(this.timeout, baseRpcUri);
  }

  

  // todo replace with json rpc
  async postRecord(
    baseUri: string,
    ns: string,
    nsIndex: string,
    ts: string,
    key: string,
    data: any
  ): Promise<AxiosResponse> {
    const url = `${baseUri}/api/v1/kv/ns/${ns}/nsidx/${nsIndex}/ts/${ts}/key/${key}`
    this.log.debug(`postRecord() ${url}`, data)
    const resp = await axios.post(url, data, { timeout: 5000 })
    this.log.debug(resp.status)
    return resp
  }

  // todo replace with json rpc
  async listRecordsByMonth(
    baseUri: string,
    ns: string,
    nsIndex: string,
    month: string,
    firstTs?: string
  ): Promise<AxiosResponse> {
    let url = `${baseUri}/api/v1/kv/ns/${ns}/nsidx/${nsIndex}/month/${month}/list/`
    if (firstTs != null) {
      url += `?firstTs=${firstTs}`
    }
    const resp = await axios.post(url, { timeout: 3000 })
    this.log.debug('listRecordsByMonth', url, resp.status, resp.data)
    return resp
  }

  // todo replace with json rpc
  async getRecord(
    baseUri: string,
    ns: string,
    nsIndex: string,
    date: string,
    key: string
  ): Promise<AxiosResponse> {
    const url = `${baseUri}/api/v1/kv/ns/${ns}/nsidx/${nsIndex}/date/${date}/key/${key}`
    const resp = await axios.get(url, { timeout: 3000 })
    this.log.debug('getRecord() ', url, ' ', resp.status, ' ', resp.data)
    return resp
  }

/*
REQ
```
{
    "jsonrpc": "2.0",
    "method": "get_accountInfo",
    "params":["eip155:1:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
    "id": 1
}
```
REPLY
```
{
    "jsonrpc": "2.0",
    "result": {
        "pushKeys": [
            {
                "masterpublickey": "0xBB",
                "did": "eip155:1:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                "derivedkeyindex": 1,
                "derivedpublickey": "0xCC",
                "address": "0xAA",
                "encrypteddervivedprivatekey": "{\"ciphertext\":\"qwe\",\"salt\":\"qaz\",\"nonce\":\"\",\"version\":\"push:v5\",\"prekey\":\"\"}",
                "signature": "ESIz"
            }
        ]
    },
    "id": 1
}
```
 */
  public async push_accountInfo(walletInCaip: string): Promise<Tuple<KeyInfo, RpcError>> {
    return await this.rpc.call(
      "push_accountInfo",
      [walletInCaip],
      (result: any): KeyInfo => result.pushKeys?.[0]);
  }
}

export type KeyInfo = {
  masterPublicKey: string;
  did: string;
  derivedKeyIndex: number;
  derivedPublicKey: string;
  address: string;
  encryptedDerivedPrivateKey: string;
  signature: string;
}
