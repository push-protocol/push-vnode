import axios, {AxiosResponse} from 'axios'
import {Logger} from 'winston'
import {WinstonUtil} from '../../utilz/winstonUtil'
import {JsonRpcClient, RpcError} from "../../utilz/jsonRpcClient";
import {UrlUtil} from "../../utilz/urlUtil";
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
    const resp = await axios.post(url, data, {timeout: 5000})
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
    const resp = await axios.post(url, {timeout: 3000})
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
    const resp = await axios.get(url, {timeout: 3000})
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

  /*
  REQUEST
  {
        "jsonrpc": "2.0",
        "method": "storage_getTransactions",
       "params":["eip155:1:0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC","INIT_DID","1728904874.000", "ASC"],
      "id": 1
  }

  REPLY

  {
      "jsonrpc": "2.0",
      "result": {
          "transactions": {
              "items": [
                  {
                      "ns": "INIT_DID",
                      "skey": "cdYO7MAPTMisiYeEp+65jw==",
                      "ts": "1729083585.013000",
                      "payload": {
                          "fee": "0",
                          "data": "CgQweEJCEAEaBDB4Q0MiIgoEMHhBQRIaChMKA3F3ZRIDcWF6IgdwdXNoOnY1EgMRIjM=",
                          "salt": "cdYO7MAPTMisiYeEp+65jw==",
                          "type": 0,
                          "sender": "eip155:1:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                          "apitoken": "VlQx...gwPQ==",
                          "category": "INIT_DID",
                          "signature": "nRXlPQ4sA/hAVT9lpqCaRJEiE/8xRbT1FA6MqLb2Q7dnQ3miLWSyzta5rPp3X9EZXDSz0HLkenMHfJkToHgJpRw=",
                          "recipientsList": [
                              "eip155:1:0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                              "eip155:1:0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
                          ]
                      }
                  }
              ],
              "lastTs": "1729083585.013000"
          }
      },
      "id": 1
  }
  */
  public async push_getTransactions(accountInCaip: string, category: string, ts: string, sortOrder: string) {
    interface Item {
      ns: string;
      skey: string;
      ts: string;
      payload: {
        fee: string;
        data: string;
        salt: string;
        type: number;
        sender: string;
        apitoken: string;
        category: string;
        signature: string;
        recipientsList: string[];
      };
    }

    return await this.rpc.call(
      "push_getTransactions",
      [accountInCaip, category, ts, sortOrder],
      function (result: any): TxInfo[] {
        const items: Item[] = result.transactions?.items;
        if (!items) {
          return [];
        }
        const txInfos: TxInfo[] = items.map(item => ({
          type: item.payload.type,
          category: item.payload.category,
          sender: item.payload.sender,
          recipients: item.payload.recipientsList,
          data: item.payload.data,
          ts: item.ts,
          salt: item.payload.salt,
        }));
        return txInfos;
      });
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

// removed technical fields: signature, apitoken, salt, fee
export type TxInfo = {
  type: number;
  category: string;
  sender: string;
  recipients: string[];
  data: string;
  ts: string;
  salt: string;
}