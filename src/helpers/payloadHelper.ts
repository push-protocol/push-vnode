import { ethers } from 'ethers'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../config/index'
import { getUser } from '../db-access/w2w'
import IPFSClient from '../helpers/ipfsClient'
import { Chat, ChatStatus, Message, User } from '../interfaces/chat'
import { caip10ToWallet } from './chatHelper'
import gr = require('graphql-request')
import * as caipHelper from './caipHelper'
import { isValidAddress } from './utilsHelper'
import { SubscribersItem } from '../services/channelsCompositeClasses/subscribersClass'
const PAYLOAD_DELIMITER = '+'
const VERIFICATION_PROOF_DELIMITER = ':'
const SETTING_DELIMITER = '+'
const OPTION_DELIMITER = '-'
module.exports = {
  /**
   * Generate Feed Payload from Original Payload
   * @param channelMeta channel details
   * @param ogPayload original payload of notification
   * @param recipient recipient of notification
   * @param verificationProof verificationProof used to verify notification
   * @returns json object => payload
   */
  generateFeedPayloadFromOriginal: function (channelMeta, ogPayload, recipient, verificationProof) {
    // Prepare original notificaiton
    // let payload = {
    //  notification: {
    //    title: channel - title of notification, | channelMeta["name"] - ogPayload->notification->title | Trim on 50 chars
    //    body: msg of notification | ogPayload->notification->body | Trim on 180 chars
    //  },
    //  data: {
    //    sid: "", | Nothing at this stage, fill before processing feeds payload
    //    type: "1", | ogPayload -> data -> type
    //    app: "Binance", | channelMeta -> name | Trim to 40 chars
    //    icon: "https://backend.epns.io/someicon.jpg", | channelMeta -> icon
    //    url: "https://channelurl.com/",  | channelMeta -> icon
    //    appbot: "0", | static include but taken care by app
    //    secret: "somesecret" | ogPayload -> data -> secret | don't trim
    //    asub: "subject", | ogPayload -> data -> asub | Trim to 80 chars
    //    amsg: "message", | ogPayload -> data -> amsg | Trim to 500 chars
    //    acta: "https://somecta.com/", | ogPayload -> data -> acta | Omit if more than 255 chars
    //    aimg: "https://anyserver.com/someimage.jpg", | Omit if more than 255 chars
    //    hidden: "0", | static include but take care by app
    //    epoch: "", | Nothing at this stage, fill before processing feeds payload epoch time "1589659592", it's in seconds
    //  },
    //  recipients: {}
    // }
    try {
      // PUSH VIDEO POC
      if (!channelMeta) {
        channelMeta = {
          name: 'internal',
          icon: 'na',
          url: 'https://app.push.org'
        }
      }

      const verificationProofType = verificationProof ? verificationProof.split(':')[0] : ''
      const verificationProofTag =
        verificationProof && verificationProof.split(':').length >= 3
          ? verificationProof.split(':')[2]
          : ''

      if ((Object.keys(channelMeta).length === 0 && ogPayload) || (channelMeta && ogPayload)) {
        const title =
          ogPayload['notification'] && ogPayload['notification']['title']
            ? ogPayload['notification']['title'].toString()
            : ''

        const body =
          ogPayload['notification'] && ogPayload['notification']['body']
            ? ogPayload['notification']['body'].toString()
            : ''

        const type =
          ogPayload['data'] && ogPayload['data']['type'] ? parseInt(ogPayload['data']['type']) : 0 // don't process
        const channel = channelMeta['name'] ? channelMeta['name'].toString() : ''
        const icon = channelMeta['icon'] ? channelMeta['icon'].toString() : ''
        const url = channelMeta['url'] ? channelMeta['url'].toString() : ''

        const sectype =
          ogPayload['data'] && ogPayload['data']['sectype']
            ? ogPayload['data']['sectype'].toString()
            : null

        let modTitle =
          sectype !== null ? channel + ' has sent you a secret message!' : channel + ' - ' + title
        modTitle = modTitle
          .toString()
          .substr(0, 50)
          .replace('[^\\u0009\\u000a\\u000d\\u0020-\\uD7FF\\uE000-\\uFFFD]', '')
        const asub =
          ogPayload['data'] && ogPayload['data']['asub'] ? ogPayload['data']['asub'].toString() : ''
        const amsg =
          ogPayload['data'] && ogPayload['data']['amsg'] ? ogPayload['data']['amsg'].toString() : ''
        const acta =
          ogPayload['data'] && ogPayload['data']['acta'] ? ogPayload['data']['acta'].toString() : ''
        const aimg =
          ogPayload['data'] && ogPayload['data']['aimg'] ? ogPayload['data']['aimg'].toString() : ''
        const silent = ogPayload['data'] && ogPayload['data']['silent'] ? '1' : '0'

        let etime =
          ogPayload['data'] && ogPayload['data']['etime']
            ? ogPayload['data']['etime'].toString()
            : null
        // explicitly set expiry for chat notifications
        if (verificationProofType === 'pgpv2' || verificationProofType === 'w2wv1') {
          etime = new Date().getTime() / 1000 + 10
        }

        if (
          ogPayload['data'] &&
          ogPayload['data']['hidden'] &&
          typeof ogPayload['data']['hidden'] === 'boolean'
        )
          ogPayload['data']['hidden'] = +ogPayload['data']['hidden']

        // explicitly hide chat notifications
        let hidden =
          ogPayload['data'] && ogPayload['data']['hidden']
            ? ogPayload['data']['hidden'].toString()
            : '0'
        // explicitly set expiry for chat notifications
        if (verificationProofType === 'pgpv2' || verificationProofType === 'w2wv1') {
          hidden = '1'
        }

        let recipients = {}
        recipient = recipient.toLowerCase()
        if (type == 1) {
          // recipients : <ChannelAddressInPartialCAIP>
          recipients = recipient
        } else if (type == 3) {
          // recipients : { <RecipientAddressInPartialCAIP> : null }
          // or
          // recipients : { <RecipientAddressInPartialCAIP> : { secret : <secret> } }
          if (sectype == null) {
            recipients[recipient] = null
          } else {
            recipient = Object.entries(ogPayload['recipients'])[0][0].toLowerCase()
            const secret = Object.entries(ogPayload['recipients'])[0][1]
            recipients[recipient] = secret
          }
        } else if (type == 4) {
          // recipients : { <Recipient_1_AddressInPartialCAIP> : null,
          //                <Recipient_2_AddressInPartialCAIP> : null,
          //                ...
          //              }
          // or
          // recipients : { <Recipient_1_AddressInPartialCAIP> : { secret : <secret> },
          //                <Recipient_2_AddressInPartialCAIP> : { secret : <secret> },
          //                ...
          //              }
          let recipientList

          //old format ogpayload conversion
          if (ogPayload['recipient']) {
            recipientList = ogPayload['recipient'].toLowerCase().split(',')
            recipientList.forEach((user) => {
              if (user != '') {
                recipients[user] = null
              }
            })
          }

          //new format ogpayload conversion
          else {
            recipientList = ogPayload['recipients']
            Object.keys(recipientList).map((user) => {
              if (user != '') {
                if (sectype == null) {
                  recipients[user.toLowerCase()] = null
                } else {
                  const secret =
                    ogPayload['recipients'] &&
                    ogPayload['recipients'][user] &&
                    ogPayload['recipients'][user]['secret']
                      ? ogPayload['recipients'][user]['secret'].toString()
                      : null
                  recipients[user.toLowerCase()] = { secret: secret }
                }
              }
            })
          }
        }

        // additionalMeta
        let additionalMeta =
          ogPayload['data'] && ogPayload['data']['additionalMeta']
            ? ogPayload['data']['additionalMeta']
            : null

        //for backward compatibility ( deprecated )
        if (additionalMeta && !additionalMeta.type) {
          additionalMeta = JSON.stringify(additionalMeta)
        }

        const payload = {
          notification: {
            title: modTitle,
            body: body
              .substr(0, 180)
              .replaceAll('[^\\u0009\\u000a\\u000d\\u0020-\\uD7FF\\uE000-\\uFFFD]', '')
          },
          data: {
            type: type,
            app: channel
              .substr(0, 40)
              .replaceAll('[^\\u0009\\u000a\\u000d\\u0020-\\uD7FF\\uE000-\\uFFFD]', ''),
            icon: icon,
            url: url,
            sectype: sectype,
            asub: asub
              .substr(0, 80)
              .replaceAll('[^\\u0009\\u000a\\u000d\\u0020-\\uD7FF\\uE000-\\uFFFD]', ''),
            amsg: amsg
              .substr(0, 500)
              .replaceAll('[^\\u0009\\u000a\\u000d\\u0020-\\uD7FF\\uE000-\\uFFFD]', ''),
            acta: acta.substr(0, 255),
            aimg: aimg.substr(0, 255),
            etime: etime,
            hidden: hidden,
            silent: silent,
            additionalMeta: additionalMeta
          },
          recipients: recipients,
          verificationProof: verificationProof
        }
        return payload
      } else {
        console.log('channelMeta or ogPayload is null')
      }
    } catch (error) {
      console.log('generateFeedPayloadFromOriginal() errored out with err: %o', error)
      throw error
    }
  },
  batchConvertRecipientToAddress: function (recipiantsInCAIP: object): object {
    const convertedRecipiants: object = {}
    Object.keys(recipiantsInCAIP).forEach((recipiantInCAIP) => {
      let recipiantAddress
      if (!isValidAddress(recipiantInCAIP)) {
        recipiantAddress = caipHelper.convertCaipToAddress(recipiantInCAIP).result
      } else {
        recipiantAddress = recipiantInCAIP
      }
      convertedRecipiants[recipiantAddress] = recipiantsInCAIP[recipiantInCAIP]
    })
    return convertedRecipiants
  },
  // To modift feed payload for AWS
  modifyFeedPayloadForAWSSNS: (feedPayload, sid) => {
    feedPayload.data.sid = sid.toString()
    feedPayload.data.epoch = (new Date().getTime() / 1000).toString() // storing in integer

    return feedPayload
  },
  // To Generate Messaging Payload from Feed
  generateMessagingPayloadFromFeed: (feedPayload) => {
    const logger = Container.get('logger')
    const payload = {
      notification: feedPayload.notification,
      apns: {
        payload: {
          aps: {
            'content-available': 1,
            'mutable-content': 1,
            category: 'withappicon'
          }
        },
        fcm_options: {
          image: feedPayload.data.icon
        }
      },
      android: {
        notification: {
          icon: '@drawable/ic_stat_name',
          color: '#e20880',
          default_vibrate_timings: 'true',
          image: feedPayload.data.icon
        }
      }
    }

    return payload
  },

  // to fetch json payload from storage type and storage pointer
  fetchPayloadJSONFromIdentity: async function (
    storageType: number,
    storagePointer: string,
    payload?
  ) {
    return await new Promise(async (resolve, reject) => {
      const logger: Logger = Container.get('logger')
      logger.debug(
        '🤖 Trying to call fetchPayloadJSONFromIdentity() | payloadHelper.ts with storage type: %s pointer: %s and payload: %o',
        storageType,
        storagePointer,
        payload
      )

      let jsonPayload = null
      let success = false
      let errorObj = null
      try {
        if (storageType === 0) {
          // Create / Fetch JSON following smart contract rules
          // EXAMPLE PAYLOAD - bytes("0+1+<title>+<body>")
          if (payload) {
            jsonPayload = payload
          } else {
            const type = parseInt(
              storagePointer.substring(0, storagePointer.indexOf(PAYLOAD_DELIMITER, 1))
            )
            const title = storagePointer.substring(
              storagePointer.indexOf(PAYLOAD_DELIMITER, 1) + 1,
              storagePointer.indexOf(PAYLOAD_DELIMITER, 3)
            )
            const body = storagePointer.substring(storagePointer.indexOf(PAYLOAD_DELIMITER, 3) + 1)
            jsonPayload = this.formatPayload({ title, body, type })
          }
          success = true
        } else if (storageType === 1) {
          // Fetch payload from IPFS
          await IPFSClient.get(storagePointer)
          try {
            jsonPayload = await IPFSClient.get(storagePointer)
            if (jsonPayload['recipients']) {
              if (typeof jsonPayload.recipients == 'string') {
                jsonPayload.recipients = caipHelper.convertCaipToAddress(payload.recipients).result
              } else {
                jsonPayload.recipients = this.batchConvertRecipientToAddress(payload.recipients)
              }
            }
            success = true
          } catch (err) {
            errorObj = err
            logger.error('Unable to fetch payload from IPFS: %o', errorObj)
          }
        } else if (storageType === 2) {
          // Fetch direct payload
          jsonPayload = payload
          if (payload['recipients']) {
            if (typeof payload.recipients == 'string') {
              jsonPayload.recipients = caipHelper.convertCaipToAddress(payload.recipients).result
            } else {
              jsonPayload.recipients = this.batchConvertRecipientToAddress(payload.recipients)
            }
          }
          success = true
        } else if (storageType === 3) {
          if (payload) {
            jsonPayload = JSON.parse(storagePointer)
            success = true
          } else {
            //check if storage pointer is correct
            if (
              storagePointer.split(':').length >= 2 &&
              storagePointer.split(PAYLOAD_DELIMITER).length >= 2
            ) {
              const subgraphInfo = storagePointer.split(':')[1]
              const subgraphId = subgraphInfo.split(PAYLOAD_DELIMITER)[0]
              const notificationNumber = subgraphInfo.split(PAYLOAD_DELIMITER)[1]
              jsonPayload = await this.getSubgraphDetails(subgraphId, notificationNumber)
              if (jsonPayload['recipients']) {
                if (typeof payload.recipients == 'string') {
                  jsonPayload.recipients = caipHelper.convertCaipToAddress(
                    payload.recipients
                  ).result
                } else {
                  jsonPayload.recipients = this.batchConvertRecipientToAddress(payload.recipients)
                }
              }
              success = true
            } else {
              success = false
            }
          }
        } else if (storageType === 4) {
          try {
            const [, cid] = storagePointer.split(':')
            jsonPayload = await this.getChatDetails(cid)
            success = true
          } catch (err) {
            success = false
          }
        } else {
          errorObj = 'not supported yet'
          jsonPayload = null
          success = false
        }
        // Finally return output
        if (success) {
          resolve({
            success: success,
            err: errorObj,
            jsonPayload: jsonPayload
          })
        } else {
          resolve({
            success: success,
            err: errorObj,
            jsonPayload: jsonPayload
          })
        }
      } catch (error) {
        reject({
          success: false,
          err: error,
          jsonPayload: null
        })
      } finally {
        logger.debug('Completed fetchPayloadJSONFromIdentity()')
      }
    })
  },
  // Verification Functions
  // 1. Verifiy Payload Identity // Basic checks to ensure payload identity conforms to NIPIPs supported storage only
  getSupportedPayloadIdentites: function () {
    // Based on NIPIPs
    return {
      min: 0,
      max: 4
    }
  },
  formatPayload: function (rawPayloadData) {
    if (rawPayloadData) {
      const data = {
        acta: rawPayloadData.cta ? rawPayloadData.cta : '',
        aimg: rawPayloadData.image ? rawPayloadData.image : '',
        amsg: rawPayloadData.message ? rawPayloadData.message : rawPayloadData.body,
        asub: rawPayloadData.subject ? rawPayloadData.subject : rawPayloadData.title,
        type: rawPayloadData.type ? rawPayloadData.type : '',
        hidden: rawPayloadData.hidden ? rawPayloadData.hidden : '0',
        etime: rawPayloadData.etime ? rawPayloadData.etime : null
      }

      return {
        data: data,
        notification: {
          title: rawPayloadData.title ? rawPayloadData.title : '',
          body: rawPayloadData.body ? rawPayloadData.body : ''
        }
      }
    } else return null
  },
  getSubgraphDetails: async function (subGraphId, id) {
    try {
      const { request, gql } = gr
      const query1 = gql`{
        epnsPushNotifications(where:{
          notificationNumber:${id}
        }) {
          id
          notificationNumber
          recipient
          notification
        }
      }
      `

      const query2 = gql`{
        pushNotifications(where:{
          notificationNumber:${id}
        }) {
          id
          notificationNumber
          recipient
          notification
        }
      }
      `
      return await new Promise(async (resolve, reject) => {
        try {
          let subgraphResponse
          try {
            subgraphResponse = await request(config.theGraphAPI + subGraphId, query1)
          } catch (error) {
            try {
              subgraphResponse = await request(config.theGraphAPI + subGraphId, query2)
            } catch (error) {
              return reject(error)
            }
          }

          let jasonifiedPayload = null
          if (
            subgraphResponse &&
            Object.keys(subgraphResponse).includes('epnsPushNotifications') &&
            subgraphResponse?.epnsPushNotifications.length != 0
          ) {
            jasonifiedPayload = JSON.parse(subgraphResponse?.epnsPushNotifications[0]?.notification)
          }
          if (
            subgraphResponse &&
            Object.keys(subgraphResponse).includes('pushNotifications') &&
            subgraphResponse?.pushNotifications.length != 0
          ) {
            jasonifiedPayload = JSON.parse(subgraphResponse?.pushNotifications[0]?.notification)
          }
          const formattedData = this.formatPayload(jasonifiedPayload)
          resolve(formattedData)
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      throw error
    }
  },
  // To segregate payload identity
  segregatePayloadIdentity: function (payloadIdentity: string): {
    success: boolean
    storageType: number
    storagePointer: string
  } {
    const logger: Logger = Container.get('logger')
    logger.info(`Try Calling segregatePayloadIdentity with identity ${payloadIdentity}`)
    const index = payloadIdentity.indexOf(PAYLOAD_DELIMITER)
    if (index == -1)
      // delimeter not found, atleast one delimeter needs to be there
      return {
        success: false,
        storageType: null,
        storagePointer: null
      }
    else {
      return {
        success: true,
        storageType: parseInt(payloadIdentity.substr(0, index)),
        storagePointer: payloadIdentity.substr(index + 1)
      }
    }
  },
  // To segregate verification proof
  segregateVerificationProof: function (verificationProof: string): {
    success: boolean
    verificationType: string | null
    verificationProof: string | null
  } {
    const logger: Logger = Container.get('logger')
    logger.info(
      `Try Calling segregateVerificationProof with verification proof ${verificationProof}`
    )
    const delimiterCount = verificationProof.split(VERIFICATION_PROOF_DELIMITER).length - 1

    // Taking account of optional uid parameter
    if (delimiterCount === 0 || delimiterCount > 8) {
      // Delimeter not found or wrong format
      return {
        success: false,
        verificationType: null,
        verificationProof: null
      }
    }
    const verificationProofComponent = verificationProof.split(VERIFICATION_PROOF_DELIMITER)
    let verificationType = verificationProofComponent[0]

    if (verificationType === 'eip155' && verificationProofComponent.length >= 2) {
      const verificationProofComponent =
        caipHelper.convertTransactionCaipToObject(verificationProof).result
      verificationType = `${verificationProofComponent.chain}:${verificationProofComponent.chainId}`
      verificationProof = verificationProofComponent.transactionHash
    } else if (
      verificationType === 'eip712v1' ||
      verificationType === 'eip712v2' ||
      (verificationType === 'thegraph' && verificationProofComponent.length >= 2)
    ) {
      verificationProof = verificationProofComponent[1]
    } else if (verificationType === 'w2wv1') {
      verificationProof = verificationProofComponent.slice(1).join(':')
    } else if (verificationType === 'pgpv2' && verificationProofComponent.length >= 4) {
      verificationProof = `${verificationProofComponent[1]}:${verificationProofComponent[2]}:${verificationProofComponent[3]}`
      if (verificationProofComponent.length === 9)
        verificationProof = verificationProof + ':' + verificationProofComponent[4]
    } else {
      // Not a valid verificationType
      return {
        success: false,
        verificationType: null,
        verificationProof: null
      }
    }

    return {
      success: true,
      verificationType,
      verificationProof
    }
  },

  // Converts to string if its in bytes or returns the string as it is if its not in bytes
  convertBytesToString: function (identityBytes: any): string {
    const logger: Logger = Container.get('logger')

    try {
      const isBytes = ethers.utils.isBytesLike(identityBytes)
      if (isBytes) {
        let identity = ethers.utils.toUtf8String(identityBytes, (_err) => {
          logger.warn('Incomple conversion from convertBytesToString() with error: %o', _err)
        })
        if (!identity) {
          identity = ''
        }
        return identity
      } else {
        return identityBytes
      }
    } catch (err) {
      logger.error('Unable to convert Bytes from Ethers, err', err)
      return ''
    }
  },

  getChatDetails: async function (payload: Message) {
    return await new Promise(async (resolve, reject) => {
      try {
        const message: Message = payload
        const user: User = await getUser(message.fromDID)
        const etime: number = new Date().getTime() / 1000 + 10 // Delete chat feeds after 10 seconds
        let userNameNotification = ''
        if (user.name && user.name.includes('.eth')) {
          userNameNotification = user.name ? ` (${user.name}) ` : ' '
        } else userNameNotification = ' '
        const notificationMessage =
          `New message from` + userNameNotification + caip10ToWallet(message.fromCAIP10)
        const formattedData = this.formatPayload({
          title: notificationMessage,
          body: notificationMessage,
          type: 1,
          hidden: '1',
          etime: etime
        })
        resolve({ success: true, err: null, jsonPayload: formattedData })
      } catch (error) {
        reject(error)
      }
    })
  },
  // channelSetting which contains all the channel Setting details
  // subscribersArray is an array of object containing subscriber and their individual setting for that channel
  // channelSettingIndex conatins information of the index of setting for which it is sending the notification
  // ex: for a 3rd index setting of type slider, channel sent a notification. it will be of the form 3-2-10
  // ex: for a 2nd index setting of type boolean, channel sent a notification, it will be of the form 2-1

  checkNotificationSetting(
    channelSetting,
    subscribersArray: SubscribersItem[],
    channelSettingIndex
  ): string[] {
    // parse channelSettingIndex
    let parsedChannelSettingIndex
    const convertedRecipiants: string[] = []
    // case when channel setting is not there or channel hasnt passed setting for the notification --> push the subscribers irrespective
    if (!channelSetting || !channelSettingIndex) {
      for (let i = 0; i < subscribersArray.length; i++) {
        convertedRecipiants.push(subscribersArray[i].subscriber)
      }
    } else {
      if (channelSettingIndex.split(OPTION_DELIMITER).length == 2) {
        parsedChannelSettingIndex = {
          index: parseInt(channelSettingIndex.split(OPTION_DELIMITER)[0]),
          type: parseInt(channelSettingIndex.split(OPTION_DELIMITER)[1])
        }
      } else if (channelSettingIndex.split(OPTION_DELIMITER).length == 3) {
        parsedChannelSettingIndex = {
          index: parseInt(channelSettingIndex.split(OPTION_DELIMITER)[0]),
          type: parseInt(channelSettingIndex.split(OPTION_DELIMITER)[1]),
          value: parseFloat(channelSettingIndex.split(OPTION_DELIMITER)[2])
        }
      }
      // channel setting is there
      channelSetting = JSON.parse(channelSetting)
      for (let i = 0; i < subscribersArray.length; i++) {
        // case when channel setting is present but user setting is not there  --> use the default of channel setting
        if (!subscribersArray[i].userSettings) {
          if (
            parsedChannelSettingIndex.type ==
              channelSetting[parsedChannelSettingIndex.index - 1].type &&
            (Object.keys(channelSetting[parsedChannelSettingIndex.index - 1]).includes('enabled')
              ? !!channelSetting[parsedChannelSettingIndex.index - 1].enabled
              : !!channelSetting[parsedChannelSettingIndex.index - 1].default)
          ) {
            convertedRecipiants.push(subscribersArray[i].subscriber)
          }
        }
        // case when channel setting is present and user setting is there --> use the user setting
        else {
          const userSetting = JSON.parse(subscribersArray[i].userSettings)
          if (
            // channel setting in db is equal to setting passed in the notification
            channelSetting[parsedChannelSettingIndex.index - 1].type ==
              parsedChannelSettingIndex.type &&
            // setting passed in the notification to user setting opted in
            parsedChannelSettingIndex.type ==
              userSetting[parsedChannelSettingIndex.index - 1].type &&
            // user has not set it to 0 or false
            (Object.keys(userSetting[parsedChannelSettingIndex.index - 1]).includes('enabled')
              ? !!userSetting[parsedChannelSettingIndex.index - 1].enabled
              : !!userSetting[parsedChannelSettingIndex.index - 1].user)
          ) {
            convertedRecipiants.push(subscribersArray[i].subscriber)
          }
        }
      }
    }

    return convertedRecipiants
  },
  getSpaceNotificationPayload: async function (space: Chat) {
    if (!space.status) {
      throw new Error(`Cannot construct payload for Push Space ${space.chatId} with no status!`)
    }
    if (space.status === ChatStatus.ENDED) {
      throw new Error(`Cannot construct payload for already ended Push Space ${space.chatId}!`)
    }
    const notificationMessage =
      space.status === ChatStatus.ACTIVE
        ? `${space.groupName} has started`
        : `${space.groupName} starting soon`
    return await new Promise(async (resolve, reject) => {
      try {
        const formattedData = this.formatPayload({
          title: notificationMessage,
          body: notificationMessage,
          type: 1,
          hidden: '1',
          etime: new Date().getTime() / 1000 + 10 // delete after 10s
        })
        resolve({ success: true, err: null, jsonPayload: formattedData })
      } catch (error) {
        reject(error)
      }
    })
  }
}
