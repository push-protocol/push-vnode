import axios, {AxiosResponse} from 'axios'
import {Logger} from 'winston'
import {WinstonUtil} from '../../utilz/winstonUtil'
import {JsonRpcClient, RpcError} from "../../utilz/jsonRpcClient";
import {UrlUtil} from "../../utilz/urlUtil";
import {EnvLoader} from "../../utilz/envLoader";
import {TypeUtil} from "../../utilz/typeUtil";

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

  public async push_accountInfo(walletInCaip: string): Promise<Tuple<KeyInfo, RpcError>> {
    return await this.rpc.call(
      "push_accountInfo",
      [walletInCaip],
      (result: any): KeyInfo => result.pushKeys);
  }

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

  /**
   * Returns [SEND, SEND, DO_NOT_SEND]
   * @param blockHashesBase16 lowercase hex hash , i.e. "aaaaaaaaaaa"
   */
  public async push_putBlockHash(blockHashesBase16: string[]): Promise<Tuple<HashReply[], RpcError>> {
    return await this.rpc.call(
      "push_putBlockHash",
      {"hashes": blockHashesBase16},
      (result: any): HashReply[] => {
        if (result==null || !TypeUtil.isStringArray(result)) {
          return [];
        }
        return result;
      });
  }

  public async push_putBlock(blocksBase16: string[]): Promise<Tuple<BlockReply[], RpcError>> {
    return await this.rpc.call(
      "push_putBlock",
      {"blocks": blocksBase16},
      (result: any): BlockReply[] => {
        if (!(result instanceof Array)) {
          return [];
        }
        return result.map(value => <BlockReply>value);
      });
  }

}

export type HashReply = "SEND"|"DO_NOT_SEND";

export type BlockReply = {
  status: 'ACCEPTED'|'REJECTED',
  reason?: string;
}

export type KeyInfo = {
  masterPublicKey: string;
  did: string;
  derivedKeyIndex: number;
  derivedPublicKey: string;
  address: string;
  encryptedDerivedPrivateKey: string;
  attachedaccounts: any;
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