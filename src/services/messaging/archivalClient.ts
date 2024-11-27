import axios, {AxiosResponse} from 'axios'
import {Logger} from 'winston'
import {WinstonUtil} from '../../utilz/winstonUtil'
import {JsonRpcClient, RpcError} from "../../utilz/jsonRpcClient";
import {UrlUtil} from "../../utilz/urlUtil";
import {EnvLoader} from "../../utilz/envLoader";
import {TypeUtil} from "../../utilz/typeUtil";
import {Tuple} from "../../utilz/tuple";
import {TxInfo, TxItem} from "./storageClient";
import {Check} from "../../utilz/check";
import {StrUtil} from "../../utilz/strUtil";

export default class ArchivalClient {
  public log: Logger = WinstonUtil.newLog(ArchivalClient)
  public timeout: number = EnvLoader.getPropertyAsNumber("ARCHIVAL_CLIENT_TIMEOUT", 5000);
  private rpc: JsonRpcClient;

  constructor(baseUri: string) {
    Check.isTrue(!StrUtil.isEmpty(baseUri), 'baseUri is empty');
    let baseRpcUri = UrlUtil.append(baseUri, '/rpc');
    this.rpc = new JsonRpcClient(this.timeout, baseRpcUri);
  }


  /**
   * Returns [SEND, SEND, DO_NOT_SEND]
   * @param blockHashesBase16 lowercase hex hash , i.e. "aaaaaaaaaaa"
   */
  public async push_putBlockHash(blockHashesBase16: string[]): Promise<Tuple<HashReply[], RpcError>> {
    return await this.rpc.call(
      "RpcService.push_putBlockHash",
      blockHashesBase16,
      (result: any): HashReply[] => {
        if (result==null || !TypeUtil.isStringArray(result)) {
          return [];
        }
        return result;
      });
  }

  public async push_putBlock(blocksBase16: string[]): Promise<Tuple<BlockReply[], RpcError>> {
    return await this.rpc.call(
      "RpcService.push_putBlock",
      blocksBase16,
      (result: any): BlockReply[] => {
        if (!(result instanceof Array)) {
          return [];
        }
        return result.map(value => <BlockReply>value);
      });
  }

  public async push_getTransactions(accountInCaip: string, category: string, ts: string, sortOrder: string) {

    return await this.rpc.call(
      "RpcService.push_getTransactions",
      [accountInCaip, category, ts, sortOrder],
      function (result: any): TxInfo[] {
        const items: TxItem[] = result.items;
        if (!items) {
          return [];
        }
        const txInfos: TxInfo[] = items.map(item => ({
          hash: item.payload.hash,
          type: item.payload.type,
          category: item.payload.category,
          sender: item.payload.sender,
          recipientsList: item.payload.recipientsList,
          data: item.payload.data,
          ts: item.ts
        }));
        return txInfos;
      });
  }

}

export type HashReply = "SEND"|"DO_NOT_SEND";

export type BlockReply = {
  status: 'ACCEPTED'|'REJECTED',
  reason?: string;
}