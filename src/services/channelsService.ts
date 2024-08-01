import { reject } from 'lodash'
import { Service, Inject } from 'typedi'
import config from '../config'
import { EventDispatcher, EventDispatcherInterface } from '../decorators/eventDispatcher'
import Subscribers from './channelsCompositeClasses/subscribersClass'
import Alias from './channelsCompositeClasses/aliasClass'
import Channels from './channelsCompositeClasses/channelsClass'
import { convertAddressToCaip, isValidCAIP10Address } from '../helpers/caipHelper'
import * as caipHelper from '../helpers/caipHelper'

import { parseUserSetting, isValidAddress } from '../helpers/utilsHelper'
import {
  IChannelAndAliasVerificationResponse,
  ISubscribeResponse
} from '../interfaces/notification/subscribers'
import { QueueManager } from './messaging/QueueManager'
import { MySqlUtil } from '../utilz/mySqlUtil'
import { client } from '../loaders/redis'
import DateUtil from '../utilz/dateUtil'
import { Logger } from 'winston'
import { NumUtil } from '../utilz/numUtil'
import { Consumer, DCmd, QItem } from './dset/queueTypes'

const db = require('../helpers/dbHelper')
const subscriberHelper = require('../helpers/subscriberVerificationHelper')

const BLOCKCHAIN_STRING = config.MAP_ID_TO_BLOCKCHAIN_STRING

/*
Here are the 4 todos for perfect sync of different nodes:

TODO add timestamps when user signs EIP712 {channel, subscriber|unsubscriber}
add a timestamp into message and use in addExternalSubscribers/removeExternalSubscribers
why: otherwise a malicious push node can change the timestamp and send it's own timestamp to other nodes,
applying changes from the past

TODO remove subscribers.alias column and replace it with join channels table
why: updates to channels can compete in time with delayed subscribers update,
and we will get stale data in alias column; that's why it should be joined dynamically
with the channels table; which should download blockchain updates at it's own pace, not related
to the subscriber data distribution between nodes

check these sql statements that use alias column which should be dropped

1 channelsService.ts
SELECT COUNT(*) FROM subscribers WHERE subscribers.alias = channels.alias_address
2 subscribersClass.ts
SELECT subscriber, user_settings FROM subscribers WHERE (alias=? AND is_currently_subscribed=1)
SELECT subscriber, (SELECT COUNT(*) FROM subscribers WHERE (alias=? AND is_currently_subscribed=1)) AS itemcount FROM subscribers WHERE (alias=? AND is_currently_subscribed=1)  LIMIT ${limit} OFFSET ${offset}
SELECT subscriber, (SELECT COUNT(*) FROM subscribers WHERE (alias=? AND is_currently_subscribed=1)) AS itemcount FROM subscribers WHERE (alias=? AND is_currently_subscribed=1)  LIMIT ${limit} OFFSET ${offset}
SELECT * FROM subscribers WHERE (alias=? AND subscriber=? AND is_currently_subscribed=1)
SELECT * FROM subscribers WHERE (alias=? AND subscriber=? AND is_currently_subscribed=1)
SELECT user_settings from subscribers where alias=? and subscriber=?

TODO remove updates from channelsService.ts processAliasData()
related to the previous point

TODO any subscription should also subscribe the user to config.epnsAdminChannel
that's a useful feature that we used to have,
but it should be done on the client side

 */
@Service('channelService')
export default class ChannelsService {
  @Inject('logger')
  private log: Logger

  @EventDispatcher()
  private eventDispatcher: EventDispatcherInterface

  @Inject('alias')
  private alias: Alias

  @Inject('channelObject')
  private channelObject: Channels

  @Inject('subscribers')
  private subscribers: Subscribers

  @Inject()
  private queueService: QueueManager

  constructor() {}

  async postConstruct() {
    this.log.debug('started ' + this.channelObject)
  }

  // NOTE: adds subs from the comm contract, and from rest apis
  public async addExternalSubscribers(
    signature: string,
    message: SubSignedData,
    chainId: number,
    verificationType: string,
    eventTs?: number
  ): Promise<SubsResult> {
    const fixedTs = eventTs != null ? eventTs : DateUtil.currentTimeMillis()
    const cmd: SubsCommand = {
      type: SubCommandType.SUB,
      ts: fixedTs,
      message: message,
      signature: signature,
      chainId: chainId,
      verificationType: verificationType
    }
    const subsResult = await this.handleSubsCommand(cmd)
    if (subsResult.success && subsResult.publishToQueue) {
      // real updates are appended to the queue
      await this.queueService.getQueue(QueueManager.QUEUE_SUBSCIRBERS).appendDirect(cmd)
    }
    return subsResult
  }

  // NOTE: adds unsubs from the comm contract, and from rest apis
  public async removeExternalSubscribers(
    signature: string,
    message: SubSignedData,
    chainId: number,
    verificationType: string,
    eventTs?: number
  ): Promise<SubsResult> {
    const fixedTs = eventTs != null ? eventTs : DateUtil.currentTimeMillis()
    const cmd: SubsCommand = {
      type: SubCommandType.UNSUB,
      ts: fixedTs,
      message: message,
      signature: signature,
      chainId: chainId,
      verificationType: verificationType
    }
    const subsResult = await this.handleSubsCommand(cmd)
    if (subsResult.success && subsResult.publishToQueue) {
      // real updates are appended to the queue
      await this.queueService.getQueue(QueueManager.QUEUE_SUBSCIRBERS).appendDirect(cmd)
    }
    return subsResult
  }


  /*
   NOTE: adds subs from other nodes
    */
  async accept(item: QItem): Promise<boolean> {
    const subsCommand = <SubsCommand>item.object
    const subsResult = await this.handleSubsCommand(subsCommand)
    return subsResult.success && subsResult.publishToQueue
  }

  public static isEthBlockchain(chainId: number) {
    const blockchain: string = config.MAP_ID_TO_BLOCKCHAIN_STRING[chainId]
    return blockchain == config.supportedSourceTypes[0] || blockchain == 'THE_GRAPH'
  }

  private static isEthZero(addr: string) {
    return '0x0000000000000000000000000000000000000000' === addr
  }

  /*
   NOTE: adds SUB/UNSUB commands

   How the timestamp logic works:

   we have 3 columns:
   timestamp
   sub_timestamp
   unsub_timestamp

   timestamp = max(sub_timestamp,unsub_timestamp)
   is_currently_subscribed = depends on what command is the last one (SUB or UNSUB)
   sub_timestamp = last subscription time (updated independently)
   unsub_timestamp = last unsubscribe time (updated independently)

   I keep both timestamps for the structure to be a LWW-Set,
   and to avoid losing the information.

   It would act fully (a more clear CRDT-version) as a LWW-Set
   if both is_currently_subscribed and timestamp would
   evaluate based on compare(sub_timestamp, unsub_timestamp)

   todo make this @synchronized
    */
  public async handleSubsCommand(cmd: SubsCommand): Promise<SubsResult> {
    this.log.debug('handleSubsCommand(): %o', cmd)
    this.log.debug(
      `Trying to verify subscribe proof of user ${cmd.message.subscriber} for channel ${cmd.message.channel}`
    )
    const contractAddr = config.MAP_ID_TO_COMM_CONTRACT[cmd.chainId]
    // check cmd.message
    const verifiedStatus: ISubscribeResponse = subscriberHelper.verifySubscribeData(
      cmd.signature,
      cmd.message,
      cmd.chainId,
      contractAddr,
      cmd.verificationType
    )
    this.log.info('Signature validation status is : %o', verifiedStatus)
    if (!(verifiedStatus.success && verifiedStatus.verified)) {
      return { success: false, publishToQueue: false }
    }
    // check channel and alias
    const channelCaip = convertAddressToCaip(cmd.message.channel, cmd.chainId).result
    const verifiedChAndAlias: IChannelAndAliasVerificationResponse =
      await subscriberHelper.verifyChannelAndAlias(cmd.chainId, channelCaip)
    if (!verifiedChAndAlias.success) {
      return { success: false, publishToQueue: false }
    }
    const channelEthAddr = verifiedChAndAlias.ethAddress
    const channelAliasAddr = verifiedChAndAlias.aliasAddress
    // for all non-eth networks, it's eth address is stored in 'alias' column
    const channelDbField = ChannelsService.isEthBlockchain(cmd.chainId) ? 'channel' : 'alias'
    let subscriberAddr
    let userSettingsForSubOnly = null
    if (cmd.type == SubCommandType.SUB) {
      subscriberAddr = cmd.message.subscriber
      const userSettings = parseUserSetting(
        cmd.message.userSetting,
        JSON.parse(verifiedChAndAlias.channelSetting),
        !cmd.message.userSetting || cmd.message.length == 0
      )
      userSettingsForSubOnly = JSON.stringify(userSettings)
    } else if (cmd.type == SubCommandType.UNSUB) {
      subscriberAddr = cmd.message.unsubscriber
    }
    if (
      ChannelsService.isEthZero(subscriberAddr) ||
      ChannelsService.isEthZero(cmd.message.channel)
    ) {
      return { success: false, publishToQueue: false }
    }
    subscriberAddr = 'eip155:' + subscriberAddr
    const rows = await MySqlUtil.queryArr<{
      channel: string
      alias: string
      subscriber: string
      timestamp: number
      sub_timestamp: number
      unsub_timestamp: number
      is_currently_subscribed: number
    }>(
      `select channel, alias, subscriber, 
       UNIX_TIMESTAMP(timestamp) as timestamp, 
       UNIX_TIMESTAMP(sub_timestamp) as sub_timestamp, 
       UNIX_TIMESTAMP(unsub_timestamp) as unsub_timestamp,
            is_currently_subscribed
             from subscribers
             where (${channelDbField} = ? AND subscriber = ?)`,
      channelEthAddr,
      subscriberAddr
    )

    if (rows.length > 1) {
      this.log.error('found multiple rows')
      return { success: false, publishToQueue: false }
    }
    const rowSubscribedTarget = cmd.type == SubCommandType.SUB ? '1' : '0'
    const cmdTs = DateUtil.millisToUnixSeconds(cmd.ts)
    // const cmdTimestamp = DateUtil.millisToDate(cmd.ts);
    if (rows.length == 0) {
      const res = await MySqlUtil.insert(
        `INSERT IGNORE INTO subscribers (channel, alias, subscriber, signature,
                                                 is_currently_subscribed, user_settings,
                                timestamp, sub_timestamp, unsub_timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
        channelEthAddr,
        channelAliasAddr,
        subscriberAddr,
        cmd.signature,
        rowSubscribedTarget,
        userSettingsForSubOnly,
        cmdTs,
        cmd.type == SubCommandType.SUB ? cmdTs : null,
        cmd.type == SubCommandType.UNSUB ? cmdTs : null
      )
      await this.cleanRedisCahe(channelEthAddr, channelAliasAddr, cmd.chainId)
      return { success: true, publishToQueue: true }
    }
    // 1 row
    const rowTs: number = NumUtil.parseInt(rows[0].timestamp, 0)
    const subTs: number = NumUtil.parseInt(rows[0].sub_timestamp, 0)
    const unsubTs: number = NumUtil.parseInt(rows[0].unsub_timestamp, 0)
    const subOrUnsubTimestampColumn: string =
      cmd.type == SubCommandType.SUB ? 'sub_timestamp' : 'unsub_timestamp'
    const cmdIsNewerThanSub = subTs != 0 && cmdTs > subTs
    const cmdIsNewerThanUnsub = unsubTs != 0 && cmdTs > unsubTs
    const updateAll = cmdIsNewerThanSub && cmdIsNewerThanUnsub
    const updateOne = cmd.type == SubCommandType.SUB ? cmdIsNewerThanSub : cmdIsNewerThanUnsub
    if (updateAll) {
      const res = await MySqlUtil.update(
        `UPDATE subscribers
         SET is_currently_subscribed=?,
             signature=?,
             user_settings=COALESCE(?, user_settings), 
             timestamp=FROM_UNIXTIME(?),
             ${subOrUnsubTimestampColumn}=FROM_UNIXTIME(?)
         WHERE channel = ?
           AND subscriber = ?`,
        rowSubscribedTarget,
        cmd.signature,
        userSettingsForSubOnly, // null for UNSUB
        cmdTs,
        cmdTs,
        channelEthAddr,
        subscriberAddr
      )
      await this.cleanRedisCahe(channelEthAddr, channelAliasAddr, cmd.chainId)
      // if the subscription is from a blockchain = we don't need that data in the queue for
      // other nodes; because they can fetch this data by themselves
      const verifiedByBlockchain = verifiedStatus.isDataFromEVMLog
      return { success: true, publishToQueue: !verifiedByBlockchain }
    } else if (updateOne) {
      // only a last timestamp update for SUB or UNSUB actions;
      const updatedRowTimestamp = Math.max(rowTs, cmdTs)
      const res = await MySqlUtil.update(
        `UPDATE subscribers
         SET user_settings=COALESCE(?, user_settings), 
             ${subOrUnsubTimestampColumn}=FROM_UNIXTIME(?),
             timestamp=FROM_UNIXTIME(?)    
         WHERE channel = ?
           AND subscriber = ?`,
        userSettingsForSubOnly,
        cmdTs,
        updatedRowTimestamp,
        channelEthAddr,
        subscriberAddr
      )
      return { success: true, publishToQueue: false }
    } else {
      return { success: true, publishToQueue: false }
    }
  }

  //@Deprecated
  private async cleanRedisCahe(channelEthAddr: string, channelAliasAddr: string, chainId: number) {
    const CHANNEL_SUBSCRIBERS_REDIS_KEY = `channel::${channelEthAddr}::${chainId}::subscribers`
    const ALIAS_SUBSCRIBERS_REDIS_KEY = `channel::${channelAliasAddr}::${chainId}::subscribers`
    await client.del(CHANNEL_SUBSCRIBERS_REDIS_KEY)
    await client.del(ALIAS_SUBSCRIBERS_REDIS_KEY)
  }

  public async getChannels(page: number, limit: number, sort: string, order: string) {
    const logger = this.log;
    const self = this
    const offset = (page - 1) * limit
    const query = `SELECT DISTINCT channels.*,
    (SELECT COUNT(*) FROM channels LEFT JOIN aliases ON channels.channel = aliases.channel WHERE channels.activation_status = 1 AND (aliases.channel IS NULL OR aliases.is_alias_verified = 1)) AS itemcount,
    (SELECT COUNT(*) FROM subscribers WHERE subscribers.channel = channels.channel AND subscribers.is_currently_subscribed=1) AS subscriber_count
    FROM channels
    LEFT JOIN aliases ON channels.channel = aliases.channel
    WHERE channels.activation_status = 1 AND (aliases.channel IS NULL OR aliases.is_alias_verified = 1)
    ORDER By channels.verified_status ${order.toUpperCase()}, subscriber_count ${order.toUpperCase()} LIMIT ${limit} OFFSET ${offset}`

    return await new Promise((resolve, reject) => {
      db.query(query, async function (err, channels) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed getChannels()')

          resolve({
            channels,
            itemcount: channels.length ? channels[0].itemcount : 0
          })
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async getChannel(aliasAddress: string) {
    const logger = this.log;
    const query = `SELECT channel from channels WHERE alias_address='${aliasAddress}' LIMIT 1;`
    return await new Promise((resolve, reject) => {
      db.query(query, async function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed getChannel(aliasAddress) with result', results)
          resolve({ count: results.length, results })
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async getChannelsByAliasAddresses(aliasAddresses: string[]): Promise<any> {
    const logger = this.log

    if (!aliasAddresses || aliasAddresses.length === 0) {
      return Promise.resolve([])
    }

    const aliasAddressesString = aliasAddresses.map((address) => `'${address}'`).join(',')

    const query = `SELECT * FROM aliases WHERE alias_address IN (${aliasAddressesString});`

    return new Promise((resolve, reject) => {
      db.query(query, function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed getChannels(aliasAddresses) with result', results)
          resolve(results)
        }
      })
    }).catch((err) => {
      logger.error(err)
      throw err
    })
  }

  public async getChannelsByChannelAddress(channelAddresses: string[]): Promise<any> {
    const logger = this.log

    if (!channelAddresses || channelAddresses.length === 0) {
      return Promise.resolve([])
    }

    const channelAddressesString = channelAddresses.map((address) => `'${address}'`).join(',')
    const query = `SELECT * FROM channels WHERE channel IN (${channelAddressesString});`

    return new Promise((resolve, reject) => {
      db.query(query, function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info(
            'Completed getChannelsByChannelAddress(channelAddresses) with result',
            results
          )
          resolve(results)
        }
      })
    }).catch((err) => {
      logger.error(err)
      throw err
    })
  }

  // a source of this event is a blockchain,
  // that's why we can edit subscriptions table directly,
  // and we don't need to broadcast these edits
  public async batchProcessAliasVerificationData() {
    const logger = this.log;
    logger.debug(
      'Trying to batch process all alias Verification Data processing, 50 requests at a time'
    )

    const query =
      'SELECT channel, alias_address, alias_verification_event FROM aliases WHERE processed=1 AND alias_verification_event is NOT NULL AND is_alias_verified=0 LIMIT 50'

    return await new Promise((resolve, reject) => {
      db.query(query, function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed batchProcessAliasVerificationData(): %o', response)

        // Now Loop the alias data
        for (const item of response) {
          const aliasEvent = JSON.parse(item.alias_verification_event)
          this.processAliasData(
            item.channel,
            item.alias_address !== null &&
              aliasEvent.aliasAddress.toLowerCase() == item.alias_address.toLowerCase(),
            item.alias_address
          )
            .then((response) => {
              logger.info(
                'Completed for batch process of processAliasData() for channel: ' + item.channel
              )
              return true
            })
            .catch((err) => {
              logger.error(
                'Error for batch process of processAliasData() for channel: ' + item.channel,
                err
              )
            })
        }
        // Finally return succes
        return { success: 1 }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  // for processing alias details for verification
  public async processAliasData(channel: string, verified: boolean, alias: string) {
    const logger = this.log;
    const self = this
    logger.debug('Trying to process alias verification for channel: ' + channel)
    const query =
      'UPDATE aliases SET is_alias_verified=?, alias_verification_event=NULL WHERE channel=? AND alias_address=?;'
    return await new Promise((resolve, reject) => {
      db.query(query, [verified, channel, alias], async function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then(() => {
        logger.info('Completed processAliasData()')
      })
      .catch((err) => {
        logger.error(err)
      })
  }

  // search for a channel
  public async searchV2(page: number, limit: number, order: string, searchQuery: any) {
    const logger = this.log
    const offset = (page - 1) * limit
    const query = `SELECT DISTINCT channels.*,
      (SELECT COUNT(*) FROM subscribers WHERE subscribers.channel = channels.channel and subscribers.is_currently_subscribed=1) AS subscriber_count
      FROM channels
      LEFT JOIN aliases ON channels.channel = aliases.channel
      WHERE (channels.name like ? or channels.channel like ?) AND channels.activation_status = 1 AND (aliases.channel IS NULL OR aliases.is_alias_verified = 1)
      ORDER By channels.verified_status ${order}, subscriber_count ${order} LIMIT ${limit} OFFSET ${offset}`
    return await new Promise((resolve, reject) => {
      db.query(
        query,
        [`%${searchQuery}%`, `%${searchQuery}%`],
        async function (err: any, results: any[]) {
          if (err) {
            logger.error(err)
            reject(err)
          } else {
            logger.info('Completed search query with result')
            resolve({
              channels: results,
              itemcount: results && results.length
            })
          }
        }
      )
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // search for a channel
  public async searchChannelDetail(
    searchQuery: any,
    address: string,
    chainId: number,
    page: number,
    pageSize: number
  ) {
    const logger = this.log
    const offset = (page - 1) * pageSize
    const self = this
    let query
    if (chainId == config.ethereumChainId)
      query = `SELECT channels.channel, channels.name, channels.icon, channels.iconV2, GROUP_CONCAT(aliases.alias_address SEPARATOR ', ') AS alias_addresses, channels.verified_status, (SELECT COUNT(*) FROM subscribers WHERE subscribers.channel = channels.channel and subscribers.is_currently_subscribed=1) AS memberCount
    FROM channels LEFT JOIN aliases ON channels.channel = aliases.channel WHERE channels.name LIKE ? OR channels.channel LIKE ? GROUP BY channels.channel, channels.name, channels.icon, channels.iconV2, channels.verified_status ORDER By channels.verified_status DESC, memberCount DESC LIMIT ${pageSize} OFFSET ${offset}`
    else
      query = `SELECT channels.channel, channels.name, channels.icon, channels.iconV2, GROUP_CONCAT(aliases.alias_address SEPARATOR ', ') AS alias_addresses, channels.verified_status, (SELECT COUNT(*) FROM subscribers WHERE subscribers.alias = channels.alias_address) AS memberCount
      FROM channels LEFT JOIN aliases ON channels.channel = aliases.channel WHERE (aliases.is_alias_verified = 1 OR aliases.is_alias_verified IS NULL) AND (channels.name LIKE ? OR channels.channel LIKE ?) GROUP BY channels.channel, channels.name, channels.icon, channels.iconV2, aliases.alias_address, channels.verified_status ORDER By memberCount DESC LIMIT ${pageSize} OFFSET ${offset}`
    return await new Promise((resolve, reject) => {
      db.query(
        query,
        [`%${searchQuery}%`, `%${searchQuery}%`],
        async function (err: any, results: any[]) {
          if (err) {
            logger.error(err)
            reject(err)
          } else {
            const channelPromises = results.map(
              async (channel: { channel; alias_address; isSubscriber }) => {
                return self.subscribers
                  .isUserSubscribed(
                    chainId == config.ethereumChainId ? channel.channel : channel.alias_address,
                    address,
                    BLOCKCHAIN_STRING[chainId]
                  )
                  .then(async (res) => {
                    channel.isSubscriber = res
                    return channel
                  })
              }
            )

            const channels = await Promise.all(channelPromises)

            channels.forEach((each) => {
              each.addr = each.channel
            })

            logger.info('Completed search query with result', channels)
            resolve({ count: channels.length, channels })
          }
        }
      )
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async setUserSetting(user, channel, userSetting) {
    const logger = this.log
    const caipObject = caipHelper.convertCaipToObject(channel).result
    const isSubscriberd = await this.subscribers.isUserSubscribed(
      channel,
      user,
      config.MAP_ID_TO_BLOCKCHAIN_STRING[caipObject.chainId]
    )
    if (isSubscriberd) {
      const channelSetting = await this.channelObject.getChannelSettings(channel)
      if (channelSetting.result) {
        const expandedUserSetting = parseUserSetting(userSetting, channelSetting.result)
        let query
        if (caipObject.chainId == config.ethereumChainId) {
          query = `UPDATE subscribers set user_settings=? where channel=? and subscriber=?`
        } else {
          query = `UPDATE subscribers set user_settings=? where alias=? and subscriber=?`
        }
        return await new Promise((resolve, reject) => {
          db.query(query, [expandedUserSetting, channel, user], function (error, results) {
            if (error) {
              return reject({
                success: false,
                error: error,
                result: null
              })
            } else {
              logger.info('Get user settings %s', results)
              if (results.length == 0) {
                return resolve({
                  success: true,
                  error: null,
                  result: null
                })
              } else {
                return resolve({
                  success: true,
                  error: null,
                  result: results[0].user_settings
                })
              }
            }
          })
        })
      }
    }
  }
}

export class SubsCommand implements DCmd {
  // subscribe or unsubscribe
  type: SubCommandType
  // the moment when the command is applied
  // NOTE: refactor this to get it from the clientside;
  // client time is much better than server side for this purpose
  ts: number

  // specifies which user subscribed/unsubscribed to which channel
  message: SubSignedData
  // signature from client side signing process, only for verificationType='eip712'
  // ex: ""eip155:5:0xf30f54fcd6d119887695eb117f673734fe402c4fb63d081f61347afef3c692bb"
  signature?: string
  // see config.MAP_ID_TO_BLOCKCHAIN_STRING
  chainId: number
  // ex: 'eip712' = signed structured data on the client
  // or 'eip155:BLOCKCHAIN_ID' = the event is process by BLOCKCHAIN = we can trust it
  verificationType: string
}

export enum SubCommandType {
  SUB = 'SUB',
  UNSUB = 'UNSUB'
}

export class SubSignedData {
  channel: string // ex: "eip155:5:0x5ac9E6205eACA2bBbA6eF716FD9AabD76326EEee"
  // filled only for subscribe actions
  subscriber?: string //  ex: "eip155:0x5ac9E6205eACA2bBbA6eF716FD9AabD76326EEee"
  // filled only for unsubscribe actions
  unsubscriber?: string //  ex: "eip155:0x5ac9E6205eACA2bBbA6eF716FD9AabD76326EEee"
  userSetting?: any
}

export class SubsResult {
  // true, if we validated and processed the update, and it is correct
  success: boolean
  // true, if as a result the db table was modified
  publishToQueue: boolean
}
