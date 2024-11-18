import axios, {AxiosResponse} from 'axios'
import {Logger} from 'winston'
import {WinstonUtil} from '../../utilz/winstonUtil'
import {JsonRpcClient, RpcError} from "../../utilz/jsonRpcClient";
import {UrlUtil} from "../../utilz/urlUtil";
import {EnvLoader} from "../../utilz/envLoader";
import {TypeUtil} from "../../utilz/typeUtil";
import {Tuple} from "../../utilz/tuple";

export default class ArchivalClient {
  public log: Logger = WinstonUtil.newLog(ArchivalClient)
  public timeout: number = EnvLoader.getPropertyAsNumber("ARCHIVAL_CLIENT_TIMEOUT", 5000);
  private rpc: JsonRpcClient;

  constructor(baseUri: string) {
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

}

export type HashReply = "SEND"|"DO_NOT_SEND";

export type BlockReply = {
  status: 'ACCEPTED'|'REJECTED',
  reason?: string;
}