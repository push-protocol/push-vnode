import axios, {AxiosError} from "axios";
import {Logger} from "winston";
import {WinstonUtil} from "./winstonUtil";
import {UrlUtil} from "./urlUtil";


export class JsonRpcClient {
  public static log: Logger = WinstonUtil.newLog(JsonRpcClient);
  requestCounter: number = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER / 10000);

  constructor(public timeout: number, public baseRpcUri: string) {
  }

  public async call<T>(method: string, params: any[], resultDeserializer: (result: any) => T): Promise<Tuple<T, RpcError>> {
    const url = this.baseRpcUri;
    const requestId = this.requestCounter++;
    const req = {
      jsonrpc: "2.0",
      method,
      params,
      id: requestId,
    };
    try {
      JsonRpcClient.log.debug(`>> Calling RPC POST ${url} (req${requestId}) with body %o`, req);
      const resp = await axios.post(url, req, {timeout: this.timeout});
      JsonRpcClient.log.debug(`<< RPC Reply POST ${url} (req${requestId}) code: ${resp.status} with body: %o`, resp.data);
      if (resp.status !== 200) {
        return [null, new RpcError(resp.data?.error?.code ?? resp.status, resp.data?.error?.message ?? 'Call error')];
      }
      const resultField = resp.data?.result;
      if (!resultField) {
        return [null, new RpcError(-1, 'Missing reply data')];
      }
      const result = resultDeserializer(resultField);
      return [result, null];
    } catch (error) {
      JsonRpcClient.log.debug(`Request failed: ${error}`);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        return [null, new RpcError(
          axiosError.response?.status ?? -1,
          'http error: ' + axiosError.message
        )];
      }
      return [null, new RpcError(-1, 'Request failed')];
    }
  }
}

export class RpcError {
  // todo use single field code , or add httpCode for clarity?
  code: number;
  message: string;

  constructor(code: number, message: string) {
    this.code = code;
    this.message = message;
  }
}