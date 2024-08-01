import { reject } from 'lodash'
import Container, { Inject, Service } from 'typedi'

import config from '../config'
import { EventDispatcher, EventDispatcherInterface } from '../decorators/eventDispatcher'
const db = require('../helpers/dbHelper')
import { NextFunction, Request, Response } from 'express'
import { Logger } from 'winston'

import { getTotalMessages, getTotalUsers } from '../db-access/w2w'
import { client } from '../loaders/redis'

const SOURCE_TYPE = config.supportedSourceTypes
@Service()
export default class AnalyticsService {
  constructor(
    @Inject('logger') private logger,
    @EventDispatcher() private eventDispatcher: EventDispatcherInterface
  ) {}

  // channel analytics
  public async channelAnalytics(startDate: Date, endDate: Date, source: string) {
    const logger = this.logger

    const ANALYTICS_REDIS_KEY = `analytics::channel::${startDate
      .toISOString()
      .slice(0, 10)}::${endDate.toISOString().slice(0, 10)}::${source}`

    const response = await client.get(ANALYTICS_REDIS_KEY)
    if (response != null) {
      return JSON.parse(response)
    }

    const startDateLimiter = `AND UNIX_TIMESTAMP(timestamp) >= UNIX_TIMESTAMP("${startDate
      .toISOString()
      .slice(0, 10)}") `

    const endDateLimiter = `AND UNIX_TIMESTAMP(timestamp) <= UNIX_TIMESTAMP("${endDate
      .toISOString()
      .slice(0, 10)}") `

    const sourceLimiter =
      source == config.supportedSourceTypes[1]
        ? `AND alias_address IS NOT NULL AND alias_address != "NULL"`
        : source == config.supportedSourceTypes[2]
        ? `AND subgraph_details IS NOT NULL AND subgraph_details != "NULL"`
        : ''

    const query = `SELECT count(*) as TotalChannels from channels where name is NOT NULL ${startDateLimiter} ${endDateLimiter} ${sourceLimiter}`

    const res = await new Promise((resolve, reject) => {
      db.query(query, [], async function (err: any, results: any) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed channel analytics query')
          resolve({ totalChannels: results[0].TotalChannels })
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })

    await client.set(ANALYTICS_REDIS_KEY, JSON.stringify(res))
    await client.expire(ANALYTICS_REDIS_KEY, 3600 * 12) //expire in 12h
    return res
  }

  //subscriber analytics
  public async subscriberAnalytics(
    startDate: Date,
    endDate: Date,
    channel: string,
    source: string
  ) {
    const logger = this.logger

    const ANALYTICS_REDIS_KEY = `analytics::subscriber::${startDate
      .toISOString()
      .slice(0, 10)}::${endDate.toISOString().slice(0, 10)}::${channel}::${source}`

    const response = await client.get(ANALYTICS_REDIS_KEY)
    if (response != null) {
      return JSON.parse(response)
    }

    const startDateLimiter = `AND UNIX_TIMESTAMP(timestamp) >= UNIX_TIMESTAMP("${startDate
      .toISOString()
      .slice(0, 10)}") `

    const endDateLimiter = `AND UNIX_TIMESTAMP(timestamp) <= UNIX_TIMESTAMP("${endDate
      .toISOString()
      .slice(0, 10)}") `

    const channelLimiter = channel != 'All' ? `AND channel = "${channel}" ` : ''

    const sourceLimiter =
      source === 'All' ||
      source === config.supportedSourceTypes[0] ||
      source === config.supportedSourceTypes[2]
        ? ''
        : `AND alias IS NOT NULL AND alias != "NULL" AND SUBSTRING_INDEX(SUBSTRING_INDEX(alias, ':', 2), ':', -1) = '${config.MAP_BLOCKCHAIN_STRING_TO_ID[source]}'`

    const query = `SELECT channels.name ,channels.icon, LOWER(sub.channel) as channel , sub.day from (select channel , DATE(timestamp) as day from subscribers where is_currently_subscribed = 1 ${startDateLimiter} ${endDateLimiter} ${channelLimiter} ${sourceLimiter} ) as sub, channels where channels.channel = sub.channel and channels.name IS NOT NULL order by day asc`

    const res = await new Promise((resolve, reject) => {
      db.query(query, [], async function (err: any, results: any) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed subscriber analytics query')

          const analytics = {}
          results.map((each) =>
            analytics[each.day] ? analytics[each.day].push(each) : (analytics[each.day] = [each])
          )

          const subscriberAnalytics = []
          const channelDetails = {}

          for (const key in analytics) {
            const dayAnalytics = { date: key }
            const subscriberData = analytics[key]

            subscriberData.map((each) => {
              if (dayAnalytics[each.channel]) {
                dayAnalytics[each.channel]['subscriber'] += 1
              } else {
                dayAnalytics[each.channel] = {
                  subscriber: 1
                }

                channelDetails[each.channel] = {
                  name: each.name,
                  icon: each.icon,
                  channel: each.channel
                }
              }
            })
            subscriberAnalytics.push(dayAnalytics)
          }
          resolve({ subscriberAnalytics: subscriberAnalytics, channelDetails: channelDetails })
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
    await client.set(ANALYTICS_REDIS_KEY, JSON.stringify(res))
    await client.expire(ANALYTICS_REDIS_KEY, 3600 * 12) //expire in 12h
    return res
  }

  //notification analytics
  public async notificationAnalytics(
    startDate: Date,
    endDate: Date,
    channel: string,
    source: string,
    spam: any
  ) {
    const logger = this.logger

    const ANALYTICS_REDIS_KEY = `analytics::notification::${startDate
      .toISOString()
      .slice(0, 10)}::${endDate.toISOString().slice(0, 10)}::${channel}::${source}::${spam}`

    const response = await client.get(ANALYTICS_REDIS_KEY)
    if (response != null) {
      return JSON.parse(response)
    }

    const startDateLimiter = `WHERE UNIX_TIMESTAMP(epoch) >= UNIX_TIMESTAMP("${startDate
      .toISOString()
      .slice(0, 10)}") `

    const endDateLimiter = `AND UNIX_TIMESTAMP(epoch) <= UNIX_TIMESTAMP("${endDate
      .toISOString()
      .slice(0, 10)}") `

    const channelLimiter = channel != 'All' ? `where channel = "${channel}" ` : ''

    const sourceLimiter = source == 'All' ? '' : `AND source = "${source}"`

    const spamLimiter = spam == 'All' ? '' : spam == true ? 'AND is_spam = 1' : 'AND is_spam = 0'

    const query1 = `SELECT name, icon, LOWER(channel) AS channel, LOWER(alias_address) AS alias from channels ${channelLimiter}`
    const query2 = `SELECT LOWER(sender) AS sender, JSON_LENGTH(users) AS notification, DATE(epoch) AS day from feeds ${startDateLimiter} ${endDateLimiter} ${spamLimiter} ${sourceLimiter}order by day asc`

    const { channelMeta, aliasMeta } = await new Promise<{
      channelMeta: Record<string, any>
      aliasMeta: Record<string, any>
    }>((resolve, reject) => {
      db.query(query1, [], async function (err: any, results: any) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          const channelMeta: Record<string, any> = {}
          const aliasMeta: Record<string, any> = {}
          results.map((each: any) => {
            channelMeta[each.channel] = {
              icon: each.icon,
              name: each.name,
              channel: each.channel
            }
            if (each.alias && each.alias !== 'NULL') {
              aliasMeta[each.alias] = channelMeta[each.channel]
            }
          })
          resolve({ channelMeta, aliasMeta })
        }
      })
    }).catch((err) => {
      logger.error(err)
      throw err
    })

    const res = await new Promise<{
      notificationAnalytics: any[]
      channelDetails: Record<string, any>
    }>((resolve, reject) => {
      db.query(query2, [], async function (err: any, results: any) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed notification analytics query')
          const analytics: Record<string, any[]> = {}
          results.map((each: any) => {
            analytics[each.day] ? analytics[each.day].push(each) : (analytics[each.day] = [each])
          })

          const notificationAnalytics: any[] = []
          const channelDetails: Record<string, any> = {}

          for (const key in analytics) {
            const dayAnalytics: Record<string, any> = { date: key }
            const notificationData = analytics[key]

            notificationData.map((each: any) => {
              const senderDetails = channelMeta[each.sender] || aliasMeta[each.sender]
              if (senderDetails) {
                const senderChannel = senderDetails['channel']
                if (dayAnalytics[senderChannel]) {
                  dayAnalytics[senderChannel].notification += each.notification
                } else {
                  dayAnalytics[senderChannel] = {
                    notification: each.notification
                  }
                  channelDetails[senderChannel] = senderDetails
                }
              }
            })
            if ((channel !== 'All' && dayAnalytics[channel.toLowerCase()]) || channel === 'All')
              notificationAnalytics.push(dayAnalytics)
          }
          resolve({ notificationAnalytics, channelDetails })
        }
      })
    }).catch((err) => {
      logger.error(err)
      throw err
    })

    await client.set(ANALYTICS_REDIS_KEY, JSON.stringify(res))
    await client.expire(ANALYTICS_REDIS_KEY, 3600 * 12) //expire in 12h
    return res
  }

  //leaderboard analytics
  public async leaderboardAnalytics(limit: number, sort: string, order: string) {
    const logger = this.logger

    const ANALYTICS_REDIS_KEY = `analytics::leaderboard::${limit}::${sort}::${order}`

    const response = await client.get(ANALYTICS_REDIS_KEY)
    if (response != null) {
      return JSON.parse(response)
    }

    const sortLimiter = sort == 'subscribers' ? `sub.subscriber` : `channels.timestamp`

    const query = `SELECT channels.name , channels.channel , sub.subscriber , channels.icon , channels.url , channels.timestamp from (select channel , count(*) as subscriber from subscribers where is_currently_subscribed = 1 GROUP BY channel) as sub, channels where channels.channel = sub.channel and channels.name IS NOT NULL ORDER BY ${sortLimiter} ${order} LIMIT ${limit}`

    const res = await new Promise((resolve, reject) => {
      db.query(query, [], async function (err: any, results: any) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed leaderboard analytics query')
          resolve({ leaderboardAnalytics: results })
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })

    await client.set(ANALYTICS_REDIS_KEY, JSON.stringify(res))
    await client.expire(ANALYTICS_REDIS_KEY, 3600 * 12) //expire in 12h
    return res
  }

  public async getChatTotalUsers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const totalUsers = await getTotalUsers()
      return res.status(200).json({ totalUsers })
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('error: %o', err)
      return next(err)
    }
  }

  public async getChatTotalMessages(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const totalMessages = await getTotalMessages()
      return res.status(200).json({ totalMessages })
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('error: %o', err)
      return next(err)
    }
  }

  //governance
  public async fetchGovernanceData() {
    const logger = this.logger
    const query = `SELECT * from governance_data where governance_key = 'governance_key'`
    return await new Promise((resolve, reject) => {
      db.query(query, [], async function (err: any, results: any) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed governance_data query')
          resolve({
            governance_data: results.length == 0 ? {} : JSON.parse(results[0]['governance_data'])
          })
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  //governance
  public async upsertGovernanceData(governance_data: string) {
    const logger = this.logger
    const query = 'REPLACE INTO governance_data (governance_key, governance_data) VALUES (?, ?)'
    const insert_data = async (query, logger) => {
      return new Promise((resolve, reject) => {
        db.query(query, ['governance_key', governance_data], function (err, results) {
          if (err) {
            logger.error(err)
            return reject(err)
          } else {
            logger.debug(results)
            console.log(results)
            return resolve({ success: 1, data: results })
          }
        })
      })
    }

    try {
      const response = await insert_data(query, logger)
      if (response.success) {
        logger.debug(response.data)
        return { success: 1 }
      }
    } catch (err) {
      logger.error(err)
      throw err
    }
  }
}
