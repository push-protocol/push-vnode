import axios, { AxiosResponse } from 'axios'
import { Logger } from 'winston'
import { WinstonUtil } from '../../utilz/winstonUtil'

export default class SNodeClient {
  public log: Logger = WinstonUtil.newLog(SNodeClient)

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
}
