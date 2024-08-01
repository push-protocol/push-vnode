import { Inject, Service } from 'typedi'

import { restrictAPICall } from '../../helpers/restrictAPICallHelper'

const db = require('../../helpers/dbHelper')
import config from '../../config'
import * as caipHelper from '../../helpers/caipHelper'
import { client } from '../../loaders/redis'

@Service('subscribers')
export default class Subscribers {
  constructor(@Inject('logger') private logger) {}

  // for subscribing to a channel
  // @Deprecated
  public async subscribeTo(
    channel: string,
    alias: string,
    subscriber: string,
    chainId: number,
    signature: string,
    userSettings: string | null = null,
    minimalUserSettings: string | null = null,
    origin: string | null = null
  ) {
    const logger = this.logger
    logger.debug(
      'Trying to add user: ' + subscriber + ' to channel: ' + channel + 'with signature ',
      signature
    )
    try {
      let isSubscribedEPNS = true
      let isAlreadySubscribedOnce = false
      isAlreadySubscribedOnce = await this.isUserSubscribed(
        channel,
        subscriber,
        config.MAP_ID_TO_BLOCKCHAIN_STRING[chainId]
      )
      const updateFlagQuery = `UPDATE subscribers SET is_currently_subscribed=1, user_settings=?, minimal_user_settings=?, origin=? WHERE channel=?  AND subscriber =?`
      db.query(
        updateFlagQuery,
        [userSettings, minimalUserSettings, origin, channel, subscriber],
        function (err: any, results: any) {
          if (err) {
            isAlreadySubscribedOnce = false
            throw err
          } else {
            logger.info('Completed subscribe()')
          }
        }
      )

      const epnsChannelAddress = config.epnsAdminChannel

      let query = `INSERT IGNORE INTO subscribers (channel, alias, subscriber, signature, is_currently_subscribed, user_settings, minimal_user_settings, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      isSubscribedEPNS = await this.isUserSubscribed(
        epnsChannelAddress,
        subscriber,
        config.MAP_ID_TO_BLOCKCHAIN_STRING[chainId]
      )
      if (!isSubscribedEPNS) query += `, (?, ?, ?, ?, ?, ?, ?, ?);`

      return await new Promise((resolve, reject) => {
        db.query(
          query,
          [
            channel,
            alias,
            subscriber,
            signature,
            1,
            userSettings,
            minimalUserSettings,
            origin,
            epnsChannelAddress,
            null,
            subscriber,
            null,
            1,
            null,
            null,
            origin
          ],
          function (err: any, results: unknown) {
            if (err) {
              return reject(err)
              // return resolve("Something went wrong")
            } else {
              return resolve(results)
            }
          }
        )
      })
        .then(async (response) => {
          logger.info('Completed subscribe()')
          const CHANNEL_SUBSCRIBERS_REDIS_KEY = `channel::${channel}::${chainId}::subscribers`
          const ALIAS_SUBSCRIBERS_REDIS_KEY = `channel::${alias}::${chainId}::subscribers`
          await client.del(CHANNEL_SUBSCRIBERS_REDIS_KEY)
          await client.del(ALIAS_SUBSCRIBERS_REDIS_KEY)
          return { success: 1 }
        })
        .catch((err) => {
          logger.error(err)
          return { success: 0 }
        })
    } catch (error) {
      logger.error(error)
      return { success: 0 }
    }
  }

  // To deconstruct the recipients field
  public async getSubscribers(channel: string, blockchain: number): Promise<SubscribersReply> {
    const logger = this.logger
    logger.debug('Trying to get all subscribers of channel: ' + channel + '')

    const CHANNEL_SUBSCRIBERS_REDIS_KEY = `channel::${channel}::${blockchain}::subscribers`

    // var response = await client.get(CHANNEL_SUBSCRIBERS_REDIS_KEY)
    // if (response != null) {
    //   return JSON.parse(response)
    // }

    let query
    if (blockchain == config.ethereumChainId)
      query =
        'SELECT subscriber, user_settings, UNIX_TIMESTAMP(timestamp) as ts, origin FROM subscribers WHERE (channel=? AND is_currently_subscribed=1)'
    else
      query =
        'SELECT subscriber, user_settings, UNIX_TIMESTAMP(timestamp) as ts, origin FROM subscribers WHERE (alias=? AND is_currently_subscribed=1)'

    return await new Promise<SubscribersReply>((resolve, reject) => {
      db.query(query, [channel, channel.toLowerCase()], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then(async (response) => {
        logger.info('Completed getSubscribers()')

        let subscribers = []
        const subscribersV2 = []
        for (var i in response) {
          subscribers.push(response[i]['subscriber'])
          subscribersV2.push({
            subscriber: response[i]?.subscriber,
            userSettings: response[i]?.user_settings,
            ts: response[i]?.ts,
            origin: response[i]?.origin
          })
        }
        //convert to lowercase
        const uniformCase = subscribers.map((x) => (typeof x === 'string' ? x.toLowerCase() : x))
        // use set DS to remove duplicates
        subscribers = Array.from(new Set(uniformCase))

      const res: SubscribersReply = {
        success: 1,
        subscribers: subscribers,
        subscribersV2: subscribersV2
      }
      await client.set(CHANNEL_SUBSCRIBERS_REDIS_KEY, JSON.stringify(res))
      await client.expire(CHANNEL_SUBSCRIBERS_REDIS_KEY, 60 * 30) // expire in 30 min
      return res
    })
  }

  private getSubscribersQuery(
    channelType: string,
    category: number | null,
    limit: number,
    offset: number,
    setting: boolean
  ) {
    if (category && setting) {
      return `SELECT subscriber, user_settings, origin, (SELECT COUNT(*) FROM subscribers WHERE (${channelType}=? AND is_currently_subscribed=1) AND (JSON_UNQUOTE(JSON_EXTRACT(user_settings, '$[${
        category - 1
      }].enabled')) = 'true'  OR JSON_UNQUOTE(JSON_EXTRACT(user_settings, '$[${
        category - 1
      }].user')) = 'true')) AS itemcount FROM subscribers WHERE (${channelType}=? AND is_currently_subscribed=1) AND (JSON_UNQUOTE(JSON_EXTRACT(user_settings, '$[${
        category - 1
      }].enabled')) = 'true'  OR JSON_UNQUOTE(JSON_EXTRACT(user_settings, '$[${
        category - 1
      }].user')) = 'true') LIMIT ${limit} OFFSET ${offset}`
    }
    if (category && !setting) {
      return `SELECT subscriber, origin, (SELECT COUNT(*) FROM subscribers WHERE (${channelType}=? AND is_currently_subscribed=1) AND (JSON_UNQUOTE(JSON_EXTRACT(user_settings, '$[${
        category - 1
      }].enabled')) = 'true'  OR JSON_UNQUOTE(JSON_EXTRACT(user_settings, '$[${
        category - 1
      }].user')) = 'true')) AS itemcount FROM subscribers WHERE (${channelType}=? AND is_currently_subscribed=1) AND (JSON_UNQUOTE(JSON_EXTRACT(user_settings, '$[${
        category - 1
      }].enabled')) = 'true'  OR JSON_UNQUOTE(JSON_EXTRACT(user_settings, '$[${
        category - 1
      }].user')) = 'true') LIMIT ${limit} OFFSET ${offset}`
    }
    if (setting) {
      return `SELECT subscriber, user_settings, origin, (SELECT COUNT(*) FROM subscribers WHERE (${channelType}=? AND is_currently_subscribed=1)) AS itemcount FROM subscribers WHERE (${channelType}=? AND is_currently_subscribed=1) LIMIT ${limit} OFFSET ${offset}`
    } else {
      return `SELECT subscriber, origin,  (SELECT COUNT(*) FROM subscribers WHERE (${channelType}=? AND is_currently_subscribed=1)) AS itemcount FROM subscribers WHERE (${channelType}=? AND is_currently_subscribed=1) LIMIT ${limit} OFFSET ${offset}`
    }
  }

  public async getSubscribersPaginated(
    channel: string,
    blockchain: number,
    page: number,
    limit: number,
    setting: boolean = false,
    category?: number | null
  ) {
    const logger = this.logger
    const offset = (page - 1) * limit
    logger.debug('Trying to get all subscribers of channel: ' + channel + '')
    let query
    if (blockchain == config.ethereumChainId) {
      // need further optmisation
      query = this.getSubscribersQuery('channel', category, limit, offset, setting)
    } else {
      query = this.getSubscribersQuery('alias', category, limit, offset, setting)
    }

    return await new Promise((resolve, reject) => {
      db.query(query, [channel, channel], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed getSubscribers()')
        // let subscribers = []
        const subscribersV2 = []
        for (const i in response) {
          // subscribers.push(response[i]['subscriber'])
          if (setting) {
            subscribersV2.push({
              subscriber: response[i]?.subscriber,
              settings: response[i]?.user_settings,
              origin: response[i]?.origin
            })
          } else {
            subscribersV2.push(response[i]?.subscriber)
          }
        }

        // const uniformCase = subscribers.map((x) => (typeof x === 'string' ? x.toLowerCase() : x))
        let uniformCaseV2 = setting
          ? subscribersV2.map((x) =>
              typeof x.subscriber === 'string'
                ? { subscriber: x.subscriber.toLowerCase(), settings: x.settings }
                : x
            )
          : subscribersV2.map((x) => (typeof x === 'string' ? x.toLowerCase() : x))

        // use set DS to remove duplicates
        // subscribers = Array.from(new Set(uniformCase))
        // subscribers = caipHelper.batchConvertCaipToAddresses(subscribers)
        if (setting) {
          for (let i = 0; i < uniformCaseV2.length; i++) {
            uniformCaseV2[i].subscriber = caipHelper.convertCaipToAddress(
              uniformCaseV2[i].subscriber
            ).result
          }
        } else {
          uniformCaseV2 = caipHelper.batchConvertCaipToAddresses(uniformCaseV2)
        }
        return {
          itemcount: response.length ? response[0].itemcount : 0,
          subscribers: uniformCaseV2
        }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  // for unsubscribing from a channel

  public async unsubscribeTo(
    channel: string,
    subscriber: string,
    chainId: any = config.ethereumChainId,
    signature?: string
  ) {
    const logger = this.logger
    logger.debug('Trying to remove user: ' + subscriber + ' from channel: ' + channel)
    await new Promise((resolve, reject) => {
      const query =
        'UPDATE subscribers SET is_currently_subscribed = 0, signature=?  WHERE channel=? AND subscriber=?;'
      db.query(query, [signature, channel, subscriber], function (err: any, results: unknown) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then(async (response) => {
        logger.info('Completed unsubscribe()')
        const CHANNEL_SUBSCRIBERS_REDIS_KEY = `channel::${channel}::${chainId}::subscribers`
        await client.del(CHANNEL_SUBSCRIBERS_REDIS_KEY)
        return { success: 1 }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  // To unsubscribe all subscribers of a channel
  public async batchUnsubscribe(channel: string) {
    const logger = this.logger
    logger.debug('Trying to remove subscribers for channel: %s', channel)
    const query = 'UPDATE subscribers SET is_currently_subscribed = 0 WHERE channel=?'
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject({ status: false, error: error })
        } else {
          logger.info('Completed batchUnsubscribe()')
          resolve({ status: true, result: results })
        }
      })
    })
  }

  //To see if a user is subscribed to a channel or not
  public async isUserSubscribed(channel: string, subscriber: string, blockchain: string) {
    const logger = this.logger
    let query
    if (caipHelper.isValidCAIP(subscriber)) {
      subscriber = `eip155:${caipHelper.convertCaipToAddress(subscriber).result}`
    }
    if (blockchain == config.supportedSourceTypes[0] || blockchain == 'THE_GRAPH')
      query =
        'SELECT * FROM subscribers WHERE (channel=? AND subscriber=? AND is_currently_subscribed=1);'
    else
      query =
        'SELECT * FROM subscribers WHERE (alias=? AND subscriber=? AND is_currently_subscribed=1);'
    return await new Promise(async (resolve, reject) => {
      db.query(query, [channel, subscriber], function (error, results) {
        if (error) {
          logger.error(error)
          reject(error)
        } else {
          if (results.length == 0) {
            resolve(false)
          } else {
            resolve(true)
          }
          logger.info('Completed isUserSubscribed()')
        }
      })
    })
  }

  // 🔥 🔥 IMPORTANT: INTERNAL METHOD / DO NOT USE
  public async _deleteSubscriber(channel: any, subscriber: any) {
    // IMPORTANT: THIS CALL IS RESTRICTED FOR TEST CASES ONLY //
    restrictAPICall('/tests/', '/src/')

    const logger = this.logger
    logger.debug('Trying to delete channel: %s and subscriber: %s', channel, subscriber)
    const query = 'DELETE FROM subscribers WHERE channel=? AND subscriber=?;'

    return await new Promise(async (resolve, reject) => {
      db.query(query, [channel, subscriber], async function (err: any, results: unknown) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed _deleteSubscriber()')
          const CHANNEL_SUBSCRIBERS_REDIS_KEY = `channel::${channel}::${config.ethereumChainId}::subscribers`
          await client.del(CHANNEL_SUBSCRIBERS_REDIS_KEY)
          resolve(results)
        }
      })
    })
  }

  public async getSubscribedChannels(user, info) {
    const logger = this.logger
    const { subscribes } = info
    let query
    //To get the channels user is subscribed to
    if (subscribes) {
      query = 'SELECT channel FROM subscribers where subscriber=? AND is_currently_subscribed=?;'
    }
    //To get the channels user is not subscribed to
    else {
      query = `SELECT c.channel FROM channels c LEFT JOIN subscribers s ON s.is_currently_subscribed=0 AND s.subscriber =?  WHERE s.channel is NULL`
    }
    return await new Promise((resolve, reject) => {
      db.query(query, [user, subscribes], function (error, results) {
        if (error) {
          return reject({
            success: false,
            error: error,
            info: {
              result: []
            }
          })
        } else {
          logger.info('Get subscribeed channels List %s', results)
          const list = []
          results.forEach((data) => {
            list.push(data.channel)
          })
          return resolve({
            success: true,
            error: null,
            info: {
              result: list
            }
          })
        }
      })
    })
  }

  public async getUserSetting(
    user,
    channel
  ): Promise<{
    success: boolean
    error: any
    result: string
    ts: number
  }> {
    const logger = this.logger
    let query
    if (caipHelper.convertCaipToObject(channel).result.chainId == config.ethereumChainId) {
      query = `SELECT user_settings, UNIX_TIMESTAMP(timestamp) as ts
               from subscribers
               where channel = ?
                 and subscriber = ?`
    } else {
      query = `SELECT user_settings, UNIX_TIMESTAMP(timestamp) as ts
               from subscribers
               where alias = ?
                 and subscriber = ?`
    }
    return await new Promise((resolve, reject) => {
      db.query(query, [channel, user], function (error, results) {
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
              result: null,
              ts: null
            })
          } else {
            return resolve({
              success: true,
              error: null,
              result: results[0].user_settings,
              ts: results[0].ts
            })
          }
        }
      })
    })
  }
}

export type SubscribersReply = {
  success: number
  subscribers: string[]
  subscribersV2: SubscribersItem[]
}

export type SubscribersItem = { subscriber: string; userSettings: string; ts: number }
