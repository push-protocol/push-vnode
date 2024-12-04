import { Inject, Service } from 'typedi'
import { Logger } from 'winston'
import { ValidatorContractState } from '../messaging-common/validatorContractState'
import { WinstonUtil } from '../../utilz/winstonUtil'
import { QueueServer } from '../messaging-dset/queueServer'
import {PgUtil} from "../../utilz/pgUtil";



@Service()
export class QueueManager {
  public log: Logger = WinstonUtil.newLog(QueueManager)

  @Inject((type) => ValidatorContractState)
  private contractState: ValidatorContractState

  // PING: schedule
  private readonly CLIENT_READ_SCHEDULE = '*/30 * * * * *'

  public static QUEUE_SUBSCIRBERS = 'subscribers'

  constructor() {}

  private static QUEUE_REPLY_PAGE_SIZE = 10
  private static CLIENT_REQUEST_PER_SCHEDULED_JOB = 10


  private mBlockQueue: QueueServer
  private queueMap = new Map<string, QueueServer>()

  // client -> queue -?-> channelService -> table <------- client
  private static QUEUE_SUBSCRIBERS = 'subscribers'
  static QUEUE_MBLOCK = 'mblock'

  public async postConstruct() {
    this.log.debug('postConstruct()')
    // setup queues that serve data to the outside world
    this.mBlockQueue = new QueueServer(QueueManager.QUEUE_MBLOCK, 10, null)
    await this.startQueue(this.mBlockQueue)
  }

  private async startQueue(queue: QueueServer) {
    const lastOffset = await queue.getLastOffset()
    this.log.debug(`starting queue %s lastOffset: %d`, queue.queueName, lastOffset)
    this.queueMap.set(queue.queueName, queue)
  }

  public getQueue(queueName: string): QueueServer {
    const result = this.queueMap.get(queueName)
    if (result == null) {
      throw new Error('invalid queue')
    }
    return result
  }

  public async getQueueLastOffsetNum(queueName: string): Promise<number> {
    return await this.getQueue(queueName).getLastOffset()
  }

  // todo: remove
  public async getQueueLastOffset(queueName: string): Promise<any> {
    const lastOffset = await this.getQueue(queueName).getLastOffset()
    return { result: lastOffset }
  }

  public async expectValidQueueName(queueName: string): Promise<void> {
    const obj = await PgUtil.queryOneRow<{ dset_name }>(
      'select queue_name from dset_server ' + 'where queue_name=?',
      queueName
    )
    if (obj == null) {
      return Promise.reject('no dset found')
    }
    return Promise.resolve()
  }

  public async readItems(dsetName: string, firstOffset: number) {
    const q = this.getQueue(dsetName)
    return await q.readWithLastOffset(firstOffset)
  }
}
