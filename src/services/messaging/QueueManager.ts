/*
This is a distributed set, which has the same contents on every node.

Every node syncs with every other node - reads it's [queue],
downloads all items starting from latest offset,
and saves them into [queue] and [set]

example:

1) initial state:
node1 <---> node2
(a,b)       (c)

2) replicates to:
node1 <---> node2
(a,b,c)       (c,a,b)

3) node 2 adds new item e
node1 <---> node2
(a,b,c)       (c,a,b, e)

4) node1 reads new item from the node2 queue, and appends it to local set
node1 <---> node2
(a,b,c, e)       (c,a,b, e)

every server: adds only new items
 */

import { Inject, Service } from 'typedi'
import { MySqlUtil } from '../../utilz/mySqlUtil'
import { Logger } from 'winston'
import ChannelsService from '../channelsService'
import schedule from 'node-schedule'
import { ValidatorContractState } from '../messaging-common/validatorContractState'
import { WinstonUtil } from '../../utilz/winstonUtil'
import { QueueServer } from '../messaging-dset/queueServer'
import { QueueClient } from '../messaging-dset/queueClient'
import { QueueClientHelper } from '../messaging-common/queueClientHelper'

/*
The data flow:

comm contract (via HistoryFetcher)
rest endpoint
   |
   |
   V
ChannelsService
    1.addExternalSubscribers    ----> SubscribersService -----> QueueInitializerValidator
    1.removeExternalSubscribers ---->        |                  3. Append to Queue
                                             V
                                   2.validate,
                                     tryAdd to db


                                     SubscribersService <------ 1. QueueClient
                                             |                       |
                                             V                       |
                                    2.validate,                      |
                                    tryAdd to db                     V
                                                               3. Append to Queue


 */
@Service()
export class QueueManager {
  public log: Logger = WinstonUtil.newLog(QueueManager)

  @Inject('channelService')
  public channelService: ChannelsService
  @Inject((type) => ValidatorContractState)
  private contractState: ValidatorContractState

  // PING: schedule
  private readonly CLIENT_READ_SCHEDULE = '*/30 * * * * *'

  public static QUEUE_SUBSCIRBERS = 'subscribers'

  constructor() {}

  private static QUEUE_REPLY_PAGE_SIZE = 10
  private static CLIENT_REQUEST_PER_SCHEDULED_JOB = 10

  private subscribersQueue: QueueServer
  private subscribersQueueClient: QueueClient
  private mBlockQueue: QueueServer
  private queueMap = new Map<string, QueueServer>()

  // client -> queue -?-> channelService -> table <------- client
  private static QUEUE_SUBSCRIBERS = 'subscribers'
  static QUEUE_MBLOCK = 'mblock'

  public async postConstruct() {
    this.log.debug('postConstruct()')
    const qv = QueueManager

    // setup queues that serve data to the outside world
    this.subscribersQueue = new QueueServer(
      qv.QUEUE_SUBSCRIBERS,
      qv.QUEUE_REPLY_PAGE_SIZE,
      this.channelService
    )
    await this.startQueue(this.subscribersQueue)

    this.mBlockQueue = new QueueServer(qv.QUEUE_MBLOCK, 10, null)
    await this.startQueue(this.mBlockQueue)

    // setup client that fetches data from remote queues
    this.subscribersQueueClient = new QueueClient(this.subscribersQueue, qv.QUEUE_SUBSCRIBERS)
    await QueueClientHelper.initClientForEveryQueueForEveryValidator(this.contractState, [
      qv.QUEUE_SUBSCIRBERS
    ])
    const qs = this
    schedule.scheduleJob(this.CLIENT_READ_SCHEDULE, async function () {
      const taskName = 'Client Read Scheduled'
      try {
        await qs.subscribersQueueClient.pollRemoteQueue(qv.CLIENT_REQUEST_PER_SCHEDULED_JOB)
        qs.log.info(`Cron Task Completed -- ${taskName}`)
      } catch (err) {
        qs.log.error(`Cron Task Failed -- ${taskName}`)
        qs.log.error(`Error Object: %o`, err)
      }
    })
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
    const obj = await MySqlUtil.queryOneRow<{ dset_name }>(
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

  public async pollRemoteQueues(): Promise<any> {
    const result = await this.subscribersQueueClient.pollRemoteQueue(1)
    return result
  }
}
