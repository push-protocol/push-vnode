import { Container, Inject } from 'typedi'

import config from '../config'
import { EventDispatcher, EventDispatcherInterface } from '../decorators/eventDispatcher'
import { convertCaipToAddress, isValidPartialCAIP10Address } from '../helpers/caipHelper'
import { generateHash } from '../helpers/cryptoHelper'
import { restrictAPICall } from '../helpers/restrictAPICallHelper'
import Channel from './channelsCompositeClasses/channelsClass'
import Subscribers from './channelsCompositeClasses/subscribersClass'
import FeedsService from './feedsService'
import db = require('../helpers/dbHelper')
const payloadHelper = require('../helpers/payloadHelper')
const payloadVerificationHelper = require('../helpers/payloadVerificationHelper')

const BLOCKCHAIN = config.MAP_BLOCKCHAIN_STRING_TO_ID

import { Logger } from 'winston'

import { getChatByChatId, getUser } from '../db-access/w2w'
import { generateHash } from '../helpers/cryptoHelper'
import { Chat, User } from '../interfaces/chat'
import { SendNotificationRules } from '../interfaces/notification'

const uuid = require('uuid')

type CONVERTED_RECIPIENTS = {}
export default class PayloadsService {
  constructor(
    @Inject('logger') private logger: Logger,
    @EventDispatcher() private eventDispatcher: EventDispatcherInterface
  ) {}

  public async addExternalPayload(
    verificationProof: string,
    sender: string,
    senderType: number = config.senderType.channel,
    recipient: string,
    source: string,
    identityBytes: any,
    rules?: SendNotificationRules
  ): Promise<boolean> {
    const logger = this.logger
    logger.info('Trying to call addExternalPayload')
    return await new Promise(async (resolve, reject) => {
      try {
        // Convert bytes to string and then extract the storage type
        const payloadIdentity: string = payloadHelper.convertBytesToString(identityBytes)
        const deconstructedVerificationProof =
          payloadHelper.segregateVerificationProof(verificationProof)

        let success = true
        let err: string
        let delegate: string
        let channel: string

        if (deconstructedVerificationProof.success) {
          // Get the response and check for the response
          const verificationResult = await payloadVerificationHelper.verifyVerificationProof(
            deconstructedVerificationProof.verificationType,
            deconstructedVerificationProof.verificationProof,
            payloadIdentity,
            sender,
            senderType,
            recipient,
            BLOCKCHAIN[source],
            source,
            rules
          )
          // Update the success and err based on the response
          success = verificationResult.response
          err = verificationResult.err
          delegate = verificationResult.delegate
          channel = verificationResult.channel
        } else {
          success = false
          err = `Appropriate verificationType not provided for ${payloadIdentity}`
          logger.error(err)
          throw new Error(err)
        }

        if (success) {
          // NOTE: identityBytes fails for type-2 because the ipfs parameter is too long
          try {
            await this.addPayload(
              verificationProof,
              sender,
              senderType,
              recipient,
              source,
              identityBytes,
              delegate,
              channel
            )
            return resolve(true)
          } catch (err) {
            logger.error('Error while adding payload %o', err)
            throw new Error(err)
          }
        }
        if (err) {
          logger.error('Something went wrong while performing addExternalPayload %o', err)
          throw new Error(err)
        }
      } catch (error) {
        logger.error('Something went wrong while performing addExternalPayload %o', error)
        reject({ status: 400, message: error.message })
      }
    })
  }

  private async _doPayloadVerification(
    verificationProof: string,
    sender: string,
    recipient: string,
    source: string,
    identityBytes: any
  ): Promise<{
    success: boolean
    err: string
    deconstructedPayload: { success: boolean; storageType: number; storagePointer: string }
  }> {
    const logger = this.logger
    logger.info('Trying to call _doPayloadVerification() | payloadsService.ts')

    // Verify the payload
    const verificationResult = await payloadVerificationHelper.verifyPayload(
      verificationProof,
      sender,
      recipient,
      source,
      identityBytes
    )

    let success: boolean = verificationResult.success
    let err: string = verificationResult.err

    if (!success) {
      logger.error('Verification of payload failed %o', verificationResult)
    }

    let deconstructedPayload = null
    if (success) {
      // Always bytes so convert to string
      deconstructedPayload = payloadHelper.segregatePayloadIdentity(identityBytes)

      if (!deconstructedPayload.success) {
        err = "Deconstructing payload failed, can't proceed"
        logger.error(err)
        success = false
      }
    }

    return { success: success, err: err, deconstructedPayload: deconstructedPayload }
  }

  private async addPayload(
    verificationProof: string,
    sender: string,
    senderType: number,
    recipient: string,
    source: string,
    identityBytes: any,
    delegate?: string,
    channel?: string
  ) {
    const logger = this.logger
    const self = this

    let payload = null
    return await new Promise(async (resolve, reject) => {
      // Add Payload to the db
      // IMPORTANT: Using storage_type as storage_type | retrive storage_type from og_payload moving forward
      try {
        const { success, err, deconstructedPayload } = await this._doPayloadVerification(
          verificationProof,
          sender,
          recipient,
          source,
          identityBytes
        )

        if (!success) {
          logger.error('addPayload() -> _doPayloadVerification() failed with error: %o', err)
          reject(err)
        }

        // Special case for type 0
        if (deconstructedPayload.storageType === 0) {
          const jsonPayload = await payloadHelper.fetchPayloadJSONFromIdentity(
            deconstructedPayload.storageType,
            deconstructedPayload.storagePointer
          )
          if (jsonPayload.success) {
            payload = JSON.stringify(jsonPayload.jsonPayload)
          }
          logger.debug('Payload Object: %o', payload)
          deconstructedPayload.storagePointer = generateHash(deconstructedPayload.storagePointer)
        } else if (deconstructedPayload.storageType === 2) {
          payload = deconstructedPayload.storagePointer
          deconstructedPayload.storagePointer = generateHash(deconstructedPayload.storagePointer)
        } else if (deconstructedPayload.storageType === 4) {
          const jsonPayload = await payloadHelper.fetchPayloadJSONFromIdentity(
            deconstructedPayload.storageType,
            deconstructedPayload.storagePointer
          )
          if (jsonPayload.success) {
            payload = JSON.stringify(jsonPayload.jsonPayload)
          }
        }

        if (success) {
          recipient = recipient.toLowerCase()
          const query =
            'INSERT INTO payloads (verification_proof, sender, delegate, channel, sender_type, recipient, storage_type, identity, source, is_spam, og_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);'

          const subscribers = Container.get(Subscribers)
          const subscriberStatus =
            senderType === config.senderType.w2w ||
            senderType === config.senderType.pushVideo ||
            senderType === config.senderType.pushSpace ||
            source == config.simulateId ||
            convertCaipToAddress(sender).result.toLowerCase() ===
              convertCaipToAddress(recipient).result.toLowerCase() ||
            (await subscribers.isUserSubscribed(sender, recipient, source))
          db.query(
            query,
            [
              verificationProof,
              sender,
              delegate,
              channel,
              senderType,
              recipient,
              deconstructedPayload.storageType,
              deconstructedPayload.storagePointer,
              source,
              !subscriberStatus,
              payload
            ],
            async function (err, results) {
              if (err) {
                logger.error(err)
                reject(err)
              } else {
                logger.info('Completed addPayload()')
                await self.processPayload(
                  results.insertId,
                  verificationProof,
                  sender,
                  delegate,
                  senderType,
                  recipient,
                  deconstructedPayload.storageType,
                  deconstructedPayload.storagePointer,
                  JSON.parse(payload),
                  source,
                  !subscriberStatus
                )
                resolve(results)
              }
            }
          )
        } else {
          logger.error('addPayload() failed to add to db with error: ', err)
          reject(err)
        }
      } catch (error) {
        logger.error('Some error occured inside addPayload(): ', error)
        reject(error)
      }
    })
  }

  // 🔥 🔥 IMPORTANT: INTERNAL METHOD / DO NOT USE
  public async _deletePayload(verificationProof) {
    // IMPORTANT: THIS CALL IS RESTRICTED FOR TEST CASES ONLY //
    restrictAPICall('/tests/', '/src/')

    const logger = this.logger
    logger.debug('Trying to call _deletePayload() from payloadsService.ts)')
    const query = 'SELECT id FROM payloads WHERE verification_proof=?'

    let success = false
    let errObj = null

    db.query(query, [verificationProof], function (err, results) {
      if (err) {
        errObj = err
        logger.error(
          `_deletePayload() failed to fetch id of payload with verificationProof: ${verificationProof} | error: ${err}`
        )
      } else {
        if (results.length > 0) {
          const payloadsId = results[0].id
          const delquery = `DELETE t1, t2 FROM payloads t1 INNER JOIN feeds t2 ON t1.id = t2.payload_id WHERE id=${payloadsId}`

          // Delete from Payloads and Feed
          db.query(delquery, [], function (err) {
            if (err) {
              errObj = err
              logger.error(
                `_deletePayload() failed to delete id of payload with id: ${payloadsId} | error: ${err}`
              )
            } else {
              logger.debug('_deletePayload() is successful')
              success = true
            }
          })
        }
      }
    })

    return { success: success, err: errObj }
  }

  // for processing payloads
  public async batchProcessPayloads() {
    const logger = this.logger
    logger.debug('Trying to call batchProcessPayloads | batch process payloads (50 at a time)')
    const query =
      'SELECT id, verification_proof, sender, delegate, sender_type, recipient, storage_type, identity, og_payload, source, is_spam FROM payloads WHERE processed=0 AND attempts<? ORDER BY attempts ASC, timestamp DESC LIMIT 50'
    return await new Promise((resolve, reject) => {
      db.query(query, [config.ipfsMaxAttempts], function (err, results) {
        if (err) {
          reject(err)
        } else {
          resolve(results)
        }
      })
    })
      .then(async (response) => {
        logger.info('Completed batchProcessPayloads()')
        // Now Loop the channel data
        try {
          for (const item of response) {
            await this.processPayload(
              item.id,
              item.verification_proof,
              item.sender,
              item.delegate,
              item.sender_type,
              item.recipient,
              item.storage_type,
              item.identity,
              JSON.parse(item.og_payload),
              item.source,
              item.is_spam
            ).then((result) => {
              logger.info(
                'Completed for batch process of batchProcessPayloads() for id: ' + result.id
              )
            })
          }

          // Finally return succes
          return { success: 1 }
        } catch (error) {
          throw error
        }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  // for processing identity
  public async processPayload(
    id,
    verificationProof: string,
    sender: string,
    delegate: string,
    senderType,
    recipient: string,
    storageType,
    storagePointer,
    payload,
    source,
    is_spam
  ) {
    //variables
    let convertedRecipients: { subscribers: { subscriber: string; userSetting }[] }[] | string[] =
      []
    let subscribed: string[] = []
    let unsubscribed: string[] = []
    let valid: boolean = true // Set valid flag for rest of logic
    let err = ''
    const aliasCheck: boolean =
      source == config.supportedSourceTypes[0] || source == config.supportedSourceTypes[2]
        ? false
        : true //alis notif check
    let og_payload = false //if payload already exists, format it or else fetch the payload
    let payloadType = -1
    let feed_payload: any = {}
    let expandedPayloadRes = {}
    let channelMeta
    let channel: string | null = null

    const logger = this.logger

    try {
      /**
       *  1. FETCH PAYLOAD
       */
      logger.debug('Trying to retrieve and process payload for sender: ' + sender + ' | id: ' + id)

      expandedPayloadRes = await payloadHelper.fetchPayloadJSONFromIdentity(
        storageType,
        storagePointer,
        payload
      )
      logger.debug('Retrieved Payload [%o]: %o', id, expandedPayloadRes)
      if (expandedPayloadRes && expandedPayloadRes.success) {
        og_payload = expandedPayloadRes.hasOwnProperty('jsonPayload')
          ? expandedPayloadRes.jsonPayload
          : null
        payloadType =
          og_payload && og_payload.hasOwnProperty('data') && og_payload.data.hasOwnProperty('type')
            ? parseInt(og_payload.data.type)
            : -1
      } else {
        throw new Error('Invalid payload !!')
      }
      /**
       * 2. FETCH META DETAILS AND CREATE FEED PAYLOAD
       */
      if (senderType == config.senderType.channel) {
        const channels = Container.get(Channel)
        channelMeta = await channels.getChannel(sender)
        channel = sender
        if (aliasCheck) {
          //Notification is from alias chain
          const aliasDetails = await channels.getAliasDetails(sender)
          const eth_address_from_alias = aliasDetails && aliasDetails.channel
          if (eth_address_from_alias)
            channelMeta = await channels.getChannel(eth_address_from_alias)
          channel = eth_address_from_alias
        }
      } else if (senderType == config.senderType.w2w) {
        const user: User = await getUser(sender as string)
        channelMeta = {
          name: 'Push Chat',
          icon: user.profilePicture,
          url: 'https://app.push.org'
        }
      } else if (senderType == config.senderType.pushVideo) {
        const user: User = await getUser(sender as string)
        channelMeta = {
          name: 'Push Video',
          icon: user.profilePicture,
          url: 'https://app.push.org'
        }
      } else if (senderType == config.senderType.pushSpace) {
        channelMeta = {
          name: 'Push Space',
          icon: payload.groupImage,
          url: 'https://app.push.org'
        }
      } else if (source == config.simulateId) {
        channelMeta = {
          name: 'Push Simulate',
          icon: payload.groupImage,
          url: 'https://app.push.org'
        }
      } else {
        throw new Error('Invalid senderType !!')
      }
      feed_payload = payloadHelper.generateFeedPayloadFromOriginal(
        channelMeta,
        og_payload,
        recipient.toLowerCase(),
        verificationProof
      )

      /**
       * 3. PREPARE RECIPIENTS
       */
      if (senderType === config.senderType.channel) {
        if (payloadType == 1) {
          const subscriber = Container.get(Subscribers)
          convertedRecipients = (await subscriber.getSubscribers(sender, BLOCKCHAIN[source]))
            .subscribersV2
          convertedRecipients = payloadHelper.checkNotificationSetting(
            channelMeta?.channel_settings ?? null,
            convertedRecipients,
            // TODO: rename it a parameter decided
            og_payload?.data?.index ?? null
          )
        } else if (payloadType == 3) {
          // Single recipient
          const subscriber = Container.get(Subscribers)
          const userSetting = await subscriber.getUserSetting(recipient, sender)
          if (!is_spam) {
            if (userSetting.result)
              convertedRecipients = [
                {
                  subscriber: recipient.toLowerCase(),
                  userSettings: userSetting?.result
                }
              ]
            else
              convertedRecipients = [
                {
                  subscriber: recipient.toLowerCase(),
                  userSettings: null
                }
              ]
            convertedRecipients = payloadHelper.checkNotificationSetting(
              channelMeta?.channel_settings ?? null,
              convertedRecipients,
              // TODO: rename it a parameter decided
              og_payload?.data?.index ?? null
            )
          } else {
            convertedRecipients = [recipient.toLowerCase()]
          }
        } else if (payloadType == 4) {
          // This is a group of recipient
          const subscriber = Container.get(Subscribers)
          const subscribersData = await subscriber.getSubscribers(sender, BLOCKCHAIN[source])
          const subscribers = subscribersData.subscribersV2.map(({ subscriber, ...rest }) => {
            return typeof subscriber === 'string'
              ? { ...rest, subscriber: subscriber.toLowerCase() }
              : { ...rest, subscriber: subscriber }
          })
          const recipients = feed_payload['recipients']

          if (Object.keys(recipients).length > config.SUBSET_NOTIF_LIMIT) {
            throw new Error(`Cannot process for more than ${config.SUBSET_NOTIF_LIMIT} recipients`)
          }

          Object.keys(recipients).map((user) => {
            if (!isValidPartialCAIP10Address(user)) {
              user = 'eip155:' + user
            }
            const subscriberIndex = subscribers.findIndex(
              (p) => p.subscriber.toLowerCase() == user.toLowerCase()
            )
            if (subscriberIndex != -1) {
              subscribed.push(subscribers[subscriberIndex])
            } else {
              unsubscribed.push(user)
            }
          })
        } else {
          throw new Error('Invalid payloadType !!')
        }
      } else if (
        senderType === config.senderType.w2w ||
        senderType === config.senderType.pushVideo ||
        senderType === config.senderType.pushSpace
      ) {
        if (verificationProof.split(':')[0] !== 'pgpv2') {
          throw new Error('Only pgpv2 verificationProof is supported !!')
        }
        let chatId: string = verificationProof.split(':')[3]
        if (chatId === 'spaces') {
          chatId = chatId + ':' + verificationProof.split(':')[4]
        }
        const chat: Chat = await getChatByChatId({ chatId })
        // Chat Members ( excluding sender )
        const members: string[] = chat.combinedDID
          .toLowerCase()
          .split('_')
          .filter((element) => element.toLowerCase() !== sender.toLowerCase())

        // chat members with approved intent ( excluding sender )
        const membersWithApprovedIntent: string[] = chat.intent
          .toLowerCase()
          .split('+')
          .filter((element) => element.toLowerCase() !== sender.toLowerCase())

        // chat members with unapproved intent ( excluding sender )
        const membersWithUnapprovedIntent: string[] = members.filter(
          (element) => !membersWithApprovedIntent.includes(element.toLowerCase())
        )

        if (payloadType == 1) {
          subscribed = membersWithApprovedIntent
          unsubscribed = membersWithUnapprovedIntent
        } else if (payloadType == 3) {
          if (!members.includes(recipient.toLowerCase())) {
            throw new Error('Recipient is not part of the chat')
          }
          if (membersWithApprovedIntent.includes(recipient.toLowerCase())) {
            subscribed = [recipient.toLowerCase()]
          } else {
            unsubscribed = [recipient.toLowerCase()]
          }
        } else if (payloadType == 4) {
          const recipients = feed_payload['recipients']
          Object.keys(recipients).map((user: string) => {
            if (membersWithApprovedIntent.includes(recipient.toLowerCase())) {
              subscribed = [recipient.toLowerCase()]
            } else if (membersWithUnapprovedIntent.includes(recipient.toLowerCase())) {
              unsubscribed = [recipient.toLowerCase()]
            }
            // skip if not part of the notification
          })
        } else {
          throw new Error('Invalid payloadType !!')
        }
      } else {
        throw new Error('Invalid senderType !!')
      }
    } catch (error) {
      logger.error(error)
      valid = false
    }

    /**
     * 4. ADD TO FEEDS TABLE
     */
    if (valid) {
      try {
        const hidden = feed_payload['data']['hidden']
        const etime = feed_payload['data']['etime']
        const feeds = Container.get(FeedsService)

        if (senderType === config.senderType.channel) {
          if (payloadType == 4) {
            convertedRecipients = payloadHelper.checkNotificationSetting(
              channelMeta.channel_settings,
              subscribed,
              // TODO: rename it a parameter decided
              og_payload?.data?.index ?? null
            )
            if (convertedRecipients.length > 0)
              await feeds.addFeed(
                id,
                sender,
                channel,
                senderType,
                convertedRecipients,
                feed_payload,
                source,
                0,
                hidden,
                etime,
                delegate
              )
            if (unsubscribed.length > 0)
              await feeds.addFeed(
                id * -1,
                sender,
                channel,
                senderType,
                unsubscribed,
                feed_payload,
                source,
                1,
                hidden,
                etime,
                delegate
              )
          } else
            await feeds.addFeed(
              id,
              sender,
              channel,
              senderType,
              convertedRecipients,
              feed_payload,
              source,
              is_spam,
              hidden,
              etime,
              delegate
            )
        } else if (
          senderType === config.senderType.w2w ||
          senderType === config.senderType.pushVideo ||
          senderType === config.senderType.pushSpace
        ) {
          if (subscribed.length > 0)
            await feeds.addFeed(
              id,
              sender,
              channel,
              senderType,
              subscribed,
              feed_payload,
              source,
              0,
              hidden,
              etime,
              delegate
            )
          if (unsubscribed.length > 0)
            await feeds.addFeed(
              id * -1,
              sender,
              channel,
              senderType,
              unsubscribed,
              feed_payload,
              source,
              1,
              hidden,
              etime,
              delegate
            )
        }
      } catch (e) {
        valid = false
        logger.error('Error while adding feeds from Payload: %o', e)
        err = e
      }
    }

    // Finally, finish processing the payload
    if (valid) {
      try {
        await this.finishProcessing(id, og_payload)

        logger.info('Completed processPayload()')
        return { success: 1, id: id, feed_payload: feed_payload }
      } catch (e) {
        valid = false
        logger.error(err)
        err = e
        throw err
      }
    } else {
      // Write attempt number before erroring out
      try {
        await this.bumpAttemptCount(id)
      } catch (e) {
        err = e
        // do nothing as this logic will now throw an error nonetheless
      } finally {
        return { success: 0, id: null, feed_payload: null }
      }
    }
  }

  // To populate payload
  private async finishProcessing(id, og_payload) {
    const logger = this.logger
    logger.debug('Finishing Processing for processPayload of id: ' + id)

    const query = 'UPDATE payloads SET og_payload=?, processed=1 WHERE id=?'

    return await new Promise(async (resolve, reject) => {
      await db.query(query, [JSON.stringify(og_payload), id], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then(async (response) => {
        logger.info('Completed populatePayload()')
        return true
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  // to bump attempt count incase it isn't processed
  private async bumpAttemptCount(id) {
    const logger = this.logger
    logger.info('Trying to call bumpAttemptCount() | PayloadsService.ts')
    try {
      const query = 'UPDATE payloads SET attempts=attempts+1 WHERE id=?'

      return await new Promise((resolve, reject) => {
        db.query(query, [id], function (err, results) {
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
    } catch (error) {
      logger.error(error)
      return false
    }
  }

  public async getLatestSubgraphId(channel: string, subgraph: string) {
    const logger = this.logger
    const query = `SELECT verification_proof FROM payloads WHERE verification_proof LIKE "graph:${subgraph}%" AND channel=? ORDER BY timestamp DESC LIMIT 1;`
    return await new Promise(async (resolve, reject) => {
      db.query(query, channel, function (error, results) {
        if (error) {
          return reject({ status: false, error: error })
        } else {
          console.log(results)
          if (results.length > 0) {
            logger.info('Completed getSubGraphDetails()')
            resolve({ status: true, result: results[0].verification_proof })
          } else {
            logger.info('Completed getSubGraphDetails() with no result')
            resolve({ status: true, result: null })
          }
        }
      })
    })
  }
}
