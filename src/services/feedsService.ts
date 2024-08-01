import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { NextFunction, Request, Response } from 'express'
import Container, { Inject, Service } from 'typedi'
import { Logger } from 'winston'

import { PushSocket } from '../api/sockets/pushsocket'
import config from '../config'
import * as notifReposiotry from '../db-access/notification'
import { EventDispatcher, EventDispatcherInterface } from '../decorators/eventDispatcher'
import { HttpStatus } from '../errors/apiConstants'
import { CommonErrors } from '../errors/commonErrors'
import { ErrorHandler } from '../errors/errorHandler'
import { ValidationError } from '../errors/validationError'
import { isAddressAlias, isValidCAIP } from '../helpers/caipHelper'
import { getProtocolMetaValues, updateProtocolMetaValues } from '../helpers/protocolMetaHelper'
import { restrictAPICall } from '../helpers/restrictAPICallHelper'

const snsClient = new SNSClient({
  credentials: {
    accessKeyId: process.env.SNS_AWS_ACCESS_KEY,
    secretAccessKey: process.env.SNS_AWS_SECRET_KEY
  },
  region: process.env.SNS_AWS_REGION
})

const db = require('../helpers/dbHelper')
const payloader = require('../helpers/payloadHelper')

@Service()
export default class FeedsService {
  constructor(
    @Inject('logger') private logger,
    @EventDispatcher() private eventDispatcher: EventDispatcherInterface
  ) {}

  private async migrateUtil(sid: number, spam: number, user: string) {
    const logger = this.logger
    const feedQuery = `
    INSERT INTO feeds_users (user, feed_sid, spam_sid)
    VALUES (?, ?, JSON_ARRAY())
    ON DUPLICATE KEY UPDATE
      feed_sid = IF(
        JSON_CONTAINS(feed_sid, CAST(? AS JSON)),
        feed_sid,
        JSON_ARRAY_APPEND(feed_sid, '$', ?)
      )
  `

    const spamQuery = `
    INSERT INTO feeds_users (user, feed_sid, spam_sid)
    VALUES (?, JSON_ARRAY(), ?)
    ON DUPLICATE KEY UPDATE
      spam_sid = IF(
      JSON_CONTAINS(spam_sid, CAST(? AS JSON)),
      spam_sid,
      JSON_ARRAY_APPEND(spam_sid, '$', ?)
    )
`

    await new Promise(async (resolve, reject) => {
      db.query(
        spam ? spamQuery : feedQuery,
        [user.toLowerCase(), JSON.stringify(sid), JSON.stringify(sid), sid],
        function (err, results) {
          if (err) {
            return reject(err)
          } else {
            return resolve(results)
          }
        }
      )
    })
      .then(async (response) => {
        return true
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  private async migrateFeed(sid: number, spam: number, users: any) {
    const logger = this.logger
    const query3 = 'UPDATE feeds set migrated=1 WHERE sid=?'
    for (const user of users) {
      await this.migrateUtil(sid, spam, user)
    }

    return await new Promise(async (resolve, reject) => {
      db.query(query3, [sid], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then(async (response) => {
        return true
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  // For adding or modifying info of channel
  public async addFeed(
    payload_id: number,
    sender: string,
    channel: string | null,
    senderType: number,
    users: {},
    feed_payload: {
      data: {}
      notification: { title: string; body: string }
      recipients: {} | string
      verificationProof: string
    },
    source: string,
    is_spam,
    hidden,
    etime,
    delegate: string | null = null
  ) {
    const logger = this.logger
    logger.debug(
      'Adding incoming feed from payload id: %s | prepared payload: %o',
      payload_id,
      feed_payload
    )

    // Need to ignore to handle the case of payloads failing, it's a bit hacky
    const query =
      etime != null
        ? 'INSERT IGNORE INTO feeds (payload_id, sender, channel, sender_type, users, feed_payload, source, is_spam, hidden, etime, delegate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), ?);'
        : 'INSERT IGNORE INTO feeds (payload_id, sender, channel, sender_type, users, feed_payload, source, is_spam, hidden, etime, delegate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);'
    return await new Promise(async (resolve, reject) => {
      db.query(
        query,
        [
          payload_id,
          sender,
          channel,
          senderType,
          JSON.stringify(users),
          JSON.stringify(feed_payload),
          source,
          is_spam,
          parseInt(hidden),
          etime,
          delegate
        ],
        function (err, results) {
          if (err) {
            return reject(err)
          } else {
            return resolve(results)
          }
        }
      )
    })
      .then(async (response: { insertId: number }) => {
        //populate feed_users
        await this.migrateFeed(response.insertId, is_spam, users)
        logger.info('Completed addFeed()')
        this.processFeed(
          response.insertId,
          payload_id,
          JSON.stringify(users),
          JSON.stringify(feed_payload),
          sender,
          is_spam
        )
          .then((res) => {
            logger.debug('Completed ProcessFeed() for sid: ' + response.insertId)
          })
          .catch((err) => {
            logger.error('Error ProcessFeed() for sid: ' + response.insertId, err)
          })
        return { success: 1 }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  // 🔥 🔥 IMPORTANT: INTERNAL METHOD / DO NOT USE
  public async _deleteFeed(payload_id: any) {
    // IMPORTANT: THIS CALL IS RESTRICTED FOR TEST CASES ONLY //
    restrictAPICall('/tests/', '/src/')

    const logger = this.logger

    logger.debug('Trying to delete feed: %s with payload id', payload_id)
    const query = 'DELETE FROM feeds WHERE payload_id=?;'

    const attempts = 0
    const processed = 0

    return await new Promise(async (resolve, reject) => {
      db.query(query, [payload_id, attempts, processed], function (err: any, results: unknown) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed deleteFeed()')
          resolve(results)
        }
      })
    })
  }

  // for batch processing feeds
  public async batchProcessFeeds() {
    const logger = this.logger
    logger.debug('Trying to batch process all feeds which are not processed, 50 requests at a time')

    const query =
      'SELECT sid, users, feed_payload, epoch, is_spam, sender FROM feeds WHERE processed=0 AND attempts<? AND is_spam=0 ORDER BY attempts ASC, epoch DESC LIMIT 50'
    return await new Promise(async (resolve, reject) => {
      await db.query(query, [config.maxDefaultAttempts], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed batchProcessFeeds(): %o', response)

        // Now Loop the channel data
        for (const item of response) {
          if (item.is_spam == 0) {
            this.processFeed(
              item.sid,
              item.payload_id,
              item.users,
              item.feed_payload,
              item.sender,
              item.is_spam
            )
              .then((response) => {
                logger.debug('Completed ProcessFeed() for sid: ' + item.sid)
              })
              .catch((err) => {
                logger.error('Error ProcessFeed() for sid: ' + item.sid, err)
              })
          }
        }

        // Finally return succes
        return { success: 1 }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  // for processing feed
  public async processFeed(
    sid: number,
    payload_id: number,
    users,
    feed_payload,
    sender: string,
    is_spam: 0 | 1
  ) {
    const logger = this.logger
    logger.debug(
      'Trying to retrieve and process feed for sid: %s | prepared payload: %o',
      sid,
      feed_payload
    )

    feed_payload = JSON.parse(feed_payload) // Unparse feed payload
    feed_payload = payloader.modifyFeedPayloadForAWSSNS(feed_payload, sid)
    const feed = {
      sid: sid,
      sender: sender,
      payload_id: payload_id,
      users: JSON.parse(users),
      payload: feed_payload,
      epoch: feed_payload.data.epoch,
      is_spam: is_spam
    }

    /**
     * SEND SOCKET EVENTS
     */
    this.sendFeedSocketEvent(sid)

    /**
     * SEND DELIVERY NODE SOCKET EVENTS
     */
    const deliveryNodes = PushSocket.getDeliveryNodes()
    const feedEvent = PushSocket.getFeedEvent()
    deliveryNodes.forEach(async (each) => {
      try {
        await feedEvent.sendLiveFeeds(each.socket.id, feed)
      } catch (e) {
        logger.error('Unable to send Feed to Delivery Node with socketId %s', each.socket.id)
      }
    })

    /**
     * PUBLISH TO AWS SNS
     */
    await this.publishFeedToSNS(sid, users, feed_payload, sender, is_spam)

    await this.finishProcessing(sid, feed_payload)
  }

  private async publishFeedToSNS(sid: number, users, feedPayload, sender, is_spam: 0 | 1) {
    const logger = this.logger
    if (config.SNS_INTEGRATION_ENABLED == 'false') {
      return
    }

    const forTypes = [`awsSNSPublishLatestEpoch`]

    let protocolSyncBlocks = {}
    await getProtocolMetaValues(forTypes, 6, logger)
      .then((protocolMeta) => {
        protocolSyncBlocks = protocolMeta
      })
      .catch((err) => {
        logger.error('error in retriving protocol sync blocks: %o', err)
        throw err
      })

    if (
      protocolSyncBlocks[`awsSNSPublishLatestEpoch`] &&
      feedPayload.data.epoch < parseInt(protocolSyncBlocks[`awsSNSPublishLatestEpoch`])
    ) {
      logger.info(
        'awsSNSPublishLatestEpoch is ahead of the feed epoch hence skipping feed with sid :: ' + sid
      )
      return
    } else {
      await updateProtocolMetaValues(
        [
          {
            type: `awsSNSPublishLatestEpoch`,
            value: feedPayload.data.epoch.toString()
          }
        ],
        6,
        logger
      ).catch((err) => {
        logger.error(
          'Error while updating migration version doMigration() | MigrationHelper with err: %o',
          err
        )
        throw err
      })
    }

    const feed = {
      sid: sid,
      sender: sender,
      users: JSON.parse(users),
      payload: feedPayload,
      epoch: feedPayload.data.epoch,
      is_spam: is_spam,
      topic: 'Notification',
      subtopic: 'Channel'
    }

    const params = {
      Message: JSON.stringify(feed),
      TopicArn: config.SNS_AWS_TOPIC_ARN
    }
    try {
      const data = await snsClient.send(new PublishCommand(params))
      logger.debug(
        'publish to SNS success for the feed of sid :: %o, response: %o',
        sid,
        JSON.stringify(data)
      )
    } catch (err) {
      logger.error('publish to SNS failed for the feed of sid :: %o', sid)
      logger.error(err)
    }
  }

  // To finish processing
  private async finishProcessing(sid: number, feed_payload) {
    const logger = this.logger
    logger.debug('Finishing Processing for processFeed of sid: ' + sid)

    const query = 'UPDATE feeds SET feed_payload=?, processed=1 WHERE sid=?'

    return await new Promise(async (resolve, reject) => {
      db.query(query, [JSON.stringify(feed_payload), sid], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then(async (response) => {
        logger.info('Completed finishProcessing()')
        return true
      })
      .catch(async (err) => {
        logger.error(err)
        await this.bumpAttemptCount(sid)
        throw err
      })
  }

  // to bump attempt count incase it isn't processed
  private async bumpAttemptCount(sid: number) {
    const logger = this.logger
    const query = 'UPDATE feeds SET attempts=attempts+1 WHERE sid=?'

    return await new Promise((resolve, reject) => {
      db.query(query, [sid], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed bumpAttemptCount()')
        return true
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  public async getFeeds(user: string, page: number, limit: number, showHidden: boolean = false) {
    const logger = this.logger
    const offset = (page - 1) * limit
    const q1 = 'SELECT feed_sid from feeds_users WHERE user=?'
    let feed_sid = await new Promise((resolve, reject) => {
      db.query(q1, [user.toLowerCase()], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            return resolve(results[0].feed_sid)
          } else {
            return resolve(JSON.stringify([]))
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })

    feed_sid = JSON.parse(feed_sid)

    if (feed_sid.length == 0) {
      logger.info('Completed getFeeds() with no result')
      return { feeds: [], itemcount: 0 }
    }

    const hiddenLimiter = showHidden ? '' : 'AND hidden=0'
    const query = `SELECT payload_id, sender, epoch ,feed_payload, source, etime, (SELECT COUNT(*) FROM feeds WHERE sid IN (?) ${hiddenLimiter}) AS itemcount FROM feeds WHERE sid IN (?) ${hiddenLimiter} ORDER BY epoch DESC LIMIT ${limit} OFFSET ${offset}`

    return await new Promise((resolve, reject) => {
      db.query(query, [feed_sid, feed_sid], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          let itemcount = 0

          if (results.length > 0) {
            logger.info('Completed getFeeds() with result', results)
            const array = []
            itemcount = results[0].itemcount

            for (let i = 0; i < results.length; i++) {
              const payload = JSON.parse(results[i].feed_payload)
              typeof payload?.data?.type == 'string'
                ? (payload.data.type = parseInt(payload.data.type))
                : (payload.data.type = payload.data.type)
              const payload_id = results[i].payload_id
              const epoch = results[i].epoch
              const sender = results[i].sender
              const source = results[i].source
              const etime = results[i].etime

              array.push({ payload_id, sender, epoch, payload, source, etime })
            }
            resolve({ feeds: array, itemcount: itemcount })
          } else {
            logger.info('Completed getFeeds() with no result')
            resolve({ feeds: results, itemcount: itemcount })
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async getChannelFeeds(user: string, channel: string, page: number, limit: number) {
    const logger = this.logger
    const offset = (page - 1) * limit
    const q1 = 'SELECT feed_sid from feeds_users WHERE user=?'
    let feed_sid = await new Promise((resolve, reject) => {
      db.query(q1, [user.toLowerCase()], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            return resolve(results[0].feed_sid)
          } else {
            return resolve(JSON.stringify([]))
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })

    feed_sid = JSON.parse(feed_sid)

    if (feed_sid.length == 0) {
      logger.info('Completed getChannelFeeds() with no result')
      return { feeds: [], itemcount: 0 }
    }

    const query = `SELECT payload_id, sender, epoch ,feed_payload, source, etime, (SELECT COUNT(*) FROM feeds WHERE sid IN (?) AND is_spam=0 AND hidden=0 AND sender = (?)) AS itemcount FROM feeds WHERE sid IN (?) AND is_spam=0 AND hidden=0 AND sender = (?) ORDER BY epoch DESC LIMIT ${limit} OFFSET ${offset}`

    return await new Promise((resolve, reject) => {
      db.query(query, [feed_sid, channel, feed_sid, channel], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          let itemcount = 0
          if (results.length > 0) {
            logger.info('Completed getChannelFeeds() with result', results)
            const array = []
            itemcount = results[0].itemcount

            for (let i = 0; i < results.length; i++) {
              const payload = JSON.parse(results[i].feed_payload)
              const payload_id = results[i].payload_id
              const epoch = results[i].epoch
              const sender = results[i].sender
              const source = results[i].source
              const etime = results[i].etime

              array.push({ payload_id, sender, epoch, payload, source, etime })
            }
            resolve({ feeds: array, itemcount: itemcount })
          } else {
            logger.info('Completed getChannelFeeds() with no result')
            resolve({ feeds: results, itemcount: itemcount })
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  /**
   * Get all the feeds of a channel
   * @dev - Returns only notifcation from 1 chain ie CAIP_Channel -> Eth Notifs, CAIP_Alias -> Alias Notifs
   */
  public async getFeedsOfChannel(
    channel: string,
    page: number,
    limit: number,
    notificationType: number | undefined
  ) {
    const logger = this.logger
    const offset = (page - 1) * limit

    let query = `SELECT payload_id, sender, epoch, feed_payload, source, etime,
    (SELECT COUNT(*) FROM feeds WHERE hidden=0 AND sender = (?)) AS itemcount
    FROM feeds
    WHERE hidden = 0
    AND sender = ?`

    // ADD NOTIFICATION_TYPE FILTER
    if (notificationType !== undefined) {
      // Modify the JSON path to access 'type' property inside 'data' property
      query += ` AND JSON_EXTRACT(feed_payload, "$.data.type") = ${notificationType}`
    }

    // ADD LIMIT AND OFFSET FILTER
    query += `
    ORDER BY epoch DESC
    LIMIT ${limit}
    OFFSET ${offset}`

    let itemcount = 0
    const usersFeeds = await new Promise((resolve, reject) => {
      db.query(query, [channel, channel], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            itemcount = results[0].itemcount
          }
          const feeds = results.map((row: any) => ({
            payload_id: row.payload_id,
            sender: row.sender,
            epoch: row.epoch,
            payload: JSON.parse(row.feed_payload),
            source: row.source,
            etime: row.etime
          }))
          resolve(feeds)
        }
      })
    }).catch((err) => {
      logger.error(err)
      throw err
    })

    logger.info('Completed getFeedsOfChannel() with result', usersFeeds)
    return { feeds: usersFeeds, itemcount: itemcount }
  }

  /**
   * Get all the feeds of a channel
   * @dev - Returns notifcation from all chains ie CAIP_Channel -> All Notifs, CAIP_Alias -> All Notifs
   */
  public async getFeedsOfChannelV2(req: Request, res: Response, next: NextFunction) {
    try {
      const logger: Logger = Container.get('logger')
      const caipAddress = req.params.channel
      const page = parseInt(req.query.page as string)
      const pageSize = parseInt(req.query.limit as string)
      const notificationType = req.query.notificationType
        ? parseInt(req.query.notificationType as string)
        : undefined
      const includeRaw = req.query.raw as any as boolean
      /******************************* PARAM VALIDATIONS **************************************/
      if (!isValidCAIP(caipAddress)) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAddress,
          'Invalid address',
          `Invalid address ${caipAddress}`
        )
      }
      /***************************************************************************************/
      const caipChannel = isAddressAlias(caipAddress)
        ? (await notifReposiotry.getAliasDetails(caipAddress)).channel
        : caipAddress

      const feedsData = await notifReposiotry.getFeedsOfChannel(
        caipChannel,
        page,
        pageSize,
        includeRaw,
        notificationType
      )
      logger.info(`Completed getFeedsOfChannelV2() with channel ${caipChannel}`)
      return res.status(200).json(feedsData)
    } catch (err) {
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * Send socket event to connected receivers of a notification
   * Event is sent for **spam** / **non-spam** / **silent** feeds
   * @param payloadId payload_id of a feed
   */
  private async sendFeedSocketEvent(sid: number): Promise<void> {
    const logger = this.logger

    const query = `select payload_id, is_spam, sender, epoch ,feed_payload, source,users from feeds WHERE sid=?`

    await new Promise((resolve, reject) => {
      db.query(query, [sid], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            let users = []
            const payload = JSON.parse(results[0].feed_payload)
            const payload_id = results[0].payload_id
            const epoch = results[0].epoch
            const sender = results[0].sender
            const source = results[0].source
            users = JSON.parse(JSON.stringify(results[0].users).toLowerCase())
            const feed = {
              payload_id: payload_id,
              sender: sender,
              epoch: epoch,
              payload: payload,
              source: source
            }
            const is_spam = results[0].is_spam

            const clients = PushSocket.getClients()
            const targetEvent = PushSocket.getTargetEvent()

            clients.forEach((each) => {
              if (users.includes(each.address.toLowerCase())) {
                if (is_spam) {
                  targetEvent.sendSingleTargetedSpam(each.socket.id, feed)
                } else {
                  targetEvent.sendSingleTargetedFeed(each.socket.id, feed)
                }
                logger.info(
                  `Feed Event sent to User -  address : ${each.address} PushSocket ID : ${each.socket.id}`
                )
              }
            })
            resolve(feed)
          } else {
            resolve({})
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
    })
  }

  public async getSpamFeeds(
    user: string,
    page: number,
    limit: number,
    showHidden: boolean = false
  ) {
    const logger = this.logger
    const offset = (page - 1) * limit
    const q1 = 'SELECT spam_sid from feeds_users WHERE user=?'
    let spam_sid = await new Promise((resolve, reject) => {
      db.query(q1, [user.toLowerCase()], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            return resolve(results[0].spam_sid)
          } else {
            return resolve(JSON.stringify([]))
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })

    spam_sid = JSON.parse(spam_sid)
    if (spam_sid.length == 0) {
      logger.info('Completed getSapmFeeds() with no result')
      return { feeds: [], itemcount: 0 }
    }

    const hiddenLimiter = showHidden ? '' : 'AND hidden=0'
    const query = `SELECT payload_id, sender, epoch ,feed_payload, source, etime, (SELECT COUNT(*) from feeds WHERE sid IN (?) ${hiddenLimiter}) AS itemcount FROM feeds WHERE sid IN (?) ${hiddenLimiter} ORDER BY epoch DESC LIMIT ${limit} OFFSET ${offset}`

    return await new Promise((resolve, reject) => {
      db.query(query, [spam_sid, spam_sid], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          let itemcount = 0

          if (results.length > 0) {
            logger.info('Completed getSpamFeeds() with result', results)
            const array = []
            itemcount = results[0].itemcount

            for (let i = 0; i < results.length; i++) {
              const payload = JSON.parse(results[i].feed_payload)
              const payload_id = results[i].payload_id
              const epoch = results[i].epoch
              const sender = results[i].sender
              const source = results[i].source
              const etime = results[i].etime

              array.push({ payload_id, sender, epoch, payload, source, etime })
            }
            resolve({ feeds: array, itemcount: itemcount })
          } else {
            logger.info('Completed getSpamFeeds() with no result')
            resolve({ feeds: results, itemcount: itemcount })
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async getUniqueSpamChannels(user: string): Promise<string[]> {
    const logger: Logger = this.logger
    const q1 = 'SELECT spam_sid FROM feeds_users WHERE user = ?'

    try {
      const spamSidResult = await new Promise<string>((resolve, reject) => {
        db.query(q1, [user.toLowerCase()], (err, results) => {
          if (err) {
            logger.error(err)
            reject(err)
          } else {
            if (results.length > 0) {
              resolve(results[0].spam_sid)
            } else {
              resolve(JSON.stringify([]))
            }
          }
        })
      })

      const spamSid: string[] = JSON.parse(spamSidResult)
      if (spamSid.length === 0) {
        logger.info('Completed getUniqueSpamChannels() with no result')
        return []
      }

      const query = 'SELECT DISTINCT sender FROM feeds WHERE sid IN (?)'
      const spamChannelsResult = await new Promise<string[]>((resolve, reject) => {
        db.query(query, [spamSid], (err, results) => {
          if (err) {
            logger.error(err)
            reject(err)
          } else {
            const spamChannels = results.map((result: any) => result.sender)
            resolve(spamChannels)
          }
        })
      })

      logger.info('Completed getUniqueSpamChannels() with result', spamChannelsResult)
      return spamChannelsResult
    } catch (err) {
      logger.error(err)
      throw err
    }
  }

  public async getChannelSpamFeeds(user: string, channel: string, page: number, limit: number) {
    const logger = this.logger
    const offset = (page - 1) * limit
    const q1 = 'SELECT spam_sid from feeds_users WHERE user=?'
    let spam_sid = await new Promise((resolve, reject) => {
      db.query(q1, [user.toLowerCase()], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            return resolve(results[0].spam_sid)
          } else {
            return resolve(JSON.stringify([]))
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })

    spam_sid = JSON.parse(spam_sid)
    if (spam_sid.length == 0) {
      logger.info('Completed getChannelSpamFeeds() with no result')
      return { feeds: [], itemcount: 0 }
    }
    const query = `SELECT payload_id, sender, epoch ,feed_payload, source, etime, (SELECT COUNT(*) from feeds WHERE sid IN (?) AND hidden=0 AND sender = (?)) AS itemcount FROM feeds WHERE sid IN (?) AND hidden=0 AND sender = (?) ORDER BY epoch DESC LIMIT ${limit} OFFSET ${offset}`

    return await new Promise((resolve, reject) => {
      db.query(query, [spam_sid, channel, spam_sid, channel], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          let itemcount = 0

          if (results.length > 0) {
            logger.info('Completed getChannelSpamFeeds() with result', results)
            const array = []
            itemcount = results[0].itemcount

            for (let i = 0; i < results.length; i++) {
              const payload = JSON.parse(results[i].feed_payload)
              const payload_id = results[i].payload_id
              const epoch = results[i].epoch
              const sender = results[i].sender
              const source = results[i].source
              const etime = results[i].etime

              array.push({ payload_id, sender, epoch, payload, source, etime })
            }
            resolve({ feeds: array, itemcount: itemcount })
          } else {
            logger.info('Completed getChannelSpamFeeds() with no result')
            resolve({ feeds: results, itemcount: itemcount })
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async searchFeeds(
    subscriber: any,
    searchTerm: any,
    isSpam: any,
    filter: string,
    page: number,
    pageSize: number
  ) {
    const logger = this.logger

    const offset = (page - 1) * pageSize

    // all channels subscriber has opted to (used if list of channels not provided as filter)
    let feedsTobeSearched = `SELECT channel FROM subscribers WHERE subscriber='${subscriber}'`

    const { channels, date } = JSON.parse(filter)

    // if list of channels as filter provided by subscriber
    if (channels) {
      feedsTobeSearched = '"' + channels.join('","') + '"'
    }

    let query = `SELECT * FROM feeds WHERE sender IN (${feedsTobeSearched})`

    if (searchTerm) {
      query += ` AND (LOWER(JSON_EXTRACT(feed_payload, '$.data.amsg')) LIKE LOWER('%${searchTerm}%') OR LOWER(JSON_EXTRACT(feed_payload, '$.data.asub')) OR LOWER(JSON_EXTRACT(feed_payload, '$.notification.title')) LIKE LOWER('%${searchTerm}%'))`
    }

    if (date) {
      const { lowDate, highDate } = date
      if (lowDate && highDate) {
        query += ` AND DATE(epoch)>'${lowDate}' AND DATE(epoch)<='${highDate}'`
      } else {
        query += ` AND DATE(epoch)='${date}'`
      }
    }

    query += ` AND is_spam=${isSpam} LIMIT ${pageSize} OFFSET ${offset};`

    logger.info(query)
    return await new Promise((resolve, reject) => {
      db.query(query, [], function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            logger.info('Completed searchFeeds() with result', results)
          } else {
            logger.info('Completed searchFeeds() with no result')
          }
          resolve({ results, count: results.length })
        }
      })
    }).catch((err) => {
      logger.error(err)
      throw err
    })
  }

  // To delete expired feeds
  public async deleteExpiredFeeds(): Promise<{ success: number }> {
    // IMPORTANT: THIS CALL IS RESTRICTED FOR JOBS ONLY //
    restrictAPICall('jobs.', 'api')

    const logger: Logger = this.logger
    const timestamp = new Date().getTime() / 1000
    logger.debug('Deleting Feeds before ' + timestamp)

    const query = 'DELETE FROM feeds WHERE etime IS NOT NULL AND UNIX_TIMESTAMP(etime) < ?'

    const delete_expired_feeds = async (
      query: string,
      logger: Logger
    ): Promise<{ success: number }> => {
      return new Promise((resolve, reject) => {
        db.query(query, timestamp, function (err, results) {
          if (err) {
            logger.error(err)
            return reject(err)
          } else {
            return resolve({ success: 1 })
          }
        })
      })
    }

    try {
      const response = await delete_expired_feeds(query, logger)
      if (response.success) {
        logger.info('Completed deleteExpiredFeeds()')
        return { success: 1 }
      }
    } catch (err) {
      logger.error(err)
      throw err
    }
  }

  public async getFeedsBetweenTimeRange(
    startTime: number,
    endTime: number,
    page: number,
    pageSize: number
  ) {
    const logger = this.logger
    const offset = (page - 1) * pageSize
    const result = []
    const query =
      'SELECT sid, payload_id, users, feed_payload, epoch from feeds WHERE is_spam = 0 and epoch BETWEEN FROM_UNIXTIME(?) AND FROM_UNIXTIME(?) LIMIT ? OFFSET ?'
    return await new Promise((resolve, reject) => {
      db.query(query, [startTime, endTime, pageSize, offset], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed getFeedsBetweenTimeRange(): %o', response)
        for (let i = 0; i < response.length; i++) {
          const payload = JSON.parse(response[i].feed_payload)
          const payload_id = response[i].payload_id
          const sid = response[i].sid
          const users = JSON.parse(response[i].users)
          const epoch = response[i].epoch

          result.push({
            payload,
            payload_id,
            sid,
            users,
            epoch
          })
        }
        return {
          feeds: result,
          count: result.length
        }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }
}
