import config from '../../config'
import { Container, Service } from 'typedi'
import { Logger } from 'winston'
import { EventDispatcher, EventDispatcherInterface } from '../../decorators/eventDispatcher'
import Subscribers, { SubscribersItem } from '../channelsCompositeClasses/subscribersClass'
import { generateHash } from '../../helpers/cryptoHelper'
import Channel from '../channelsCompositeClasses/channelsClass'
import { getChatByChatId, getUser } from '../../db-access/w2w'
import { Chat, User } from '../../interfaces/chat'
import { isValidPartialCAIP10Address } from '../../helpers/chatHelper'
import { MsgDeliveryService } from './msgDeliveryService'
import {
  FeedItem,
  FHeader,
  FPayload,
  PayloadItem,
  Recipient,
  SenderType
} from '../messaging-common/messageBlock'

import * as payloadHelper from '../../helpers/payloadHelper'
import * as payloadVerificationHelper from '../../helpers/payloadVerificationHelper'
import { WinstonUtil } from '../../utilz/winstonUtil'
import { EnvLoader } from '../../utilz/envLoader'
import { convertCaipToAddress } from '../../helpers/caipHelper'

const BLOCKCHAIN = config.MAP_BLOCKCHAIN_STRING_TO_ID

/*
Our core notification processing logic packed from payloads.ts/feeds.ts
Input is PayloadItem
Output is FeedItem

TODO isSpam should be applied at the UI layer depending on whether address(this) in recipient[]

     if (payloadType == PayloadType.SUBSET) {
            if (subscribed.length > 0) {
                await this.addFeed(payloadId, sender, senderType, subscribed, feed_payload,
                    source, false, hidden, etime);
            }
            if (unsubscribed.length > 0) {
                await this.addFeed(payloadId, sender, senderType, unsubscribed, feed_payload,
                    source, true, hidden, etime);
            }

       if (is_spam) {
            // send to sockets
            this.deliveryService.sendSpamEvent(payloadId, sender, senderType, users,
                feed_payload, source, is_spam, hidden, etime, did) //event for spam feed
        }

NOTE: method names are intentionally like in payloadService.ts / feedService.ts for easier diff
*/

@Service()
export class MsgConverterService {
  public log: Logger = WinstonUtil.newLog(MsgConverterService)
  private static skipProof = config?.skipVerificationProofCheck
  private deliveryService: MsgDeliveryService

  constructor(@EventDispatcher() private eventDispatcher: EventDispatcherInterface) {
    this.deliveryService = Container.get(MsgDeliveryService)
  }

  // REQS: determenistic, idempotent, NO SIDE EFFECTS, NO STORAGE WRITES
  public async addExternalPayload(p: PayloadItem): Promise<FeedItem> {
    this.log.info('addExternalPayload() input payload item %s', p)
    const payloadIdentity: string = payloadHelper.convertBytesToString(p.identityBytes)
    const deconstructedVerificationProof = payloadHelper.segregateVerificationProof(
      p.verificationProof
    )
    let success = true
    let err: string
    if (deconstructedVerificationProof?.success) {
      // Get the response and check for the response
      const verificationResult = await payloadVerificationHelper.verifyVerificationProof(
        deconstructedVerificationProof.verificationType,
        deconstructedVerificationProof.verificationProof,
        payloadIdentity,
        p.sender,
        p.senderType,
        p.recipient,
        BLOCKCHAIN[p.source]
      )
      success = verificationResult.response
      if (MsgConverterService.skipProof) {
        success = true
      }
      err = verificationResult.err
    } else {
      success = false
      err = `Appropriate verificationType not provided for ${payloadIdentity}`
    }
    if (EnvLoader.getPropertyAsBool('VALIDATOR_SKIP_PAYLOAD_VERIFICATION')) {
      success = true
      this.log.warn('skipping verification because the flag is set! only for debug!')
    }
    if (!success) {
      this.log.error(err)
      return null
    }
    const result = await this.addPayload(p)
    this.log.info('addExternalPayload() feed item conversion result: %s', JSON.stringify(result))
    return result
  }

  // OK
  private async _doPayloadVerification(p: PayloadItem): Promise<PayloadIdentityInfo> {
    this.log.info('_doPayloadVerification()')
    const verificationResult = await payloadVerificationHelper.verifyPayload(
      p.verificationProof,
      p.sender,
      p.recipient,
      p.source,
      p.identityBytes
    )
    const success: boolean = verificationResult.success
    const err: string = verificationResult.err
    if (!success) {
      this.log.error('Verification of payload failed %o', verificationResult)
      return null
    }
    const payloadIdentity: PayloadIdentityInfo = payloadHelper.segregatePayloadIdentity(
      p.identityBytes
    )
    if (!payloadIdentity?.success) {
      this.log.error("Deconstructing payload failed, can't proceed", verificationResult)
      return null
    }
    return payloadIdentity
  }

  // todo This logic replicates
  // payloadService.ts addPayload()
  // be extremely careful while merging updates from the original method
  private async addPayload(p: PayloadItem): Promise<FeedItem> {
    let payload = null
    // Add Payload to the db
    // IMPORTANT: Using storage_type as storage_type | retrive storage_type from og_payload moving forward
    const st = await this._doPayloadVerification(p)
    if (st == null) {
      this.log.error('failed to build a deconstructed payload')
      return null
    }
    // Special case for type 0
    if (st.storageType === StorageType.EMBEDDED) {
      const jsonPayload = await payloadHelper.fetchPayloadJSONFromIdentity(
        st.storageType,
        st.storagePointer
      )
      if (jsonPayload.success) {
        payload = JSON.stringify(jsonPayload.jsonPayload)
      }
      this.log.debug('Payload Object: %o', payload)
      st.storagePointer = generateHash(st.storagePointer)
    } else if (st.storageType === StorageType.DIRECT_PAYLOAD) {
      payload = st.storagePointer
      st.storagePointer = generateHash(st.storagePointer)
    } else if (st.storageType === StorageType.CHAT) {
      const jsonPayload = await payloadHelper.fetchPayloadJSONFromIdentity(
        st.storageType,
        st.storagePointer
      )
      if (jsonPayload.success) {
        payload = JSON.stringify(jsonPayload.jsonPayload)
      }
    }
    const subscribers = Container.get(Subscribers)
    const subscriberStatus =
      p.senderType === config.senderType.w2w ||
      p.senderType === config.senderType.pushVideo ||
      p.senderType === config.senderType.pushSpace ||
      convertCaipToAddress(p.sender).result.toLowerCase() ===
        convertCaipToAddress(p.recipient).result.toLowerCase() ||
      (await subscribers.isUserSubscribed(p.sender, p.recipient, p.source))
    return await this.processPayload(
      p.id,
      p.verificationProof,
      p.sender,
      p.senderType,
      p.recipient.toLowerCase(),
      st.storageType,
      st.storagePointer,
      JSON.parse(payload),
      p.source,
      !subscriberStatus
    )
  }

  filterUsingSubscriberNames(
    subscriberItems: SubscribersItem[],
    approvedSubscibersList: string[]
  ): SubscribersItem[] {
    const subscriberToItem = new Map<string, SubscribersItem>(
      subscriberItems.map((obj) => {
        return [obj.subscriber, obj]
      })
    )
    return approvedSubscibersList.map(
      (subscriber) =>
        <SubscribersItem>{
          subscriber: subscriber,
          userSettings: null,
          ts: subscriberToItem.get(subscriber).ts
        }
    )
  }

  // todo This logic replicates
  // payloadService.ts processPayload()
  // be extremely careful while merging updates from the original method
  private async processPayload(
    payloadId: string,
    verificationProof: string,
    sender: string,
    senderType: number,
    recipient: string,
    storageType: number,
    storagePointer: string,
    payload: any,
    source: string,
    is_spam: boolean
  ): Promise<FeedItem> {
    //variables
    let convertedRecipients: SubscribersItem[] = []
    let subscribed: string[] = []
    let unsubscribed: string[] = []
    const err = ''
    const aliasCheck: boolean = source == config.supportedSourceTypes[0] ? false : true //to check if notification from alias or not
    let og_payload = false //if payload already exists, format it or else fetch the payload
    let payloadType = -1
    let feed_payload: FPayload = null
    let channelMeta
    this.log.debug(
      'Trying to retrieve and process payload for sender: ' + sender + ' | payloadId: ' + payloadId
    )
    /**
     *  1. FETCH PAYLOAD
     */
    const expandedPayloadRes = await payloadHelper.fetchPayloadJSONFromIdentity(
      storageType,
      storagePointer,
      payload
    )
    this.log.debug('Retrieved Payload [%o]: %o', payloadId, expandedPayloadRes)
    if (expandedPayloadRes) {
      // if a reject comes, await will throw an exception so this if is useless; todo optimize
      const validByPayload: boolean = expandedPayloadRes.hasOwnProperty('success')
        ? expandedPayloadRes.success
        : false
      if (!validByPayload) {
        return null
      }
      // todo remove property check
      og_payload = expandedPayloadRes.hasOwnProperty('jsonPayload')
        ? expandedPayloadRes.jsonPayload
        : null
      payloadType =
        og_payload && og_payload.hasOwnProperty('data') && og_payload.data.hasOwnProperty('type')
          ? parseInt(og_payload?.data?.type)
          : -1
    }
    /**
     * 2. FETCH META DETAILS AND CREATE FEED PAYLOAD
     */
    // Get channel meta and make feed_payload
    // For channel sender, channel meta will be empty
    if (senderType == SenderType.CHANNEL) {
      const channels = Container.get(Channel)
      channelMeta = await channels.getChannel(sender)
      if (aliasCheck) {
        //Notification is from alias chain
        const aliasDetails = <{ channel: string }>await channels.getAliasDetails(sender)
        const eth_address_from_alias = aliasDetails && aliasDetails.channel
        if (eth_address_from_alias) channelMeta = await channels.getChannel(eth_address_from_alias)
      }
    } else if (senderType === SenderType.W2W) {
      const user: User = await getUser(sender as string)
      channelMeta = {
        name: 'Push Chat',
        icon: user.profilePicture,
        url: 'https://app.push.org'
      }
    } else if (senderType == SenderType.PUSH_VIDEO) {
      const user: User = await getUser(sender as string)
      channelMeta = {
        name: 'Push Video',
        icon: user.profilePicture,
        url: 'https://app.push.org'
      }
    } else if (senderType == SenderType.PUSH_SPACE) {
      channelMeta = {
        name: 'Push Space',
        icon: payload.groupImage,
        url: 'https://app.push.org'
      }
    } else {
      throw new Error('Invalid senderType !!')
    }
    feed_payload = <FPayload>(
      payloadHelper.generateFeedPayloadFromOriginal(
        channelMeta,
        og_payload,
        recipient.toLowerCase(),
        verificationProof
      )
    )
    this.log.debug('payload type is %d', payloadType)

    /**
     * 3. PREPARE RECIPIENTS
     */
    if (senderType === SenderType.CHANNEL) {
      // START CHANNEL TYPE
      if (payloadType == PayloadType.BROADCAST) {
        const subscriber = Container.get(Subscribers)
        const recipients = (await subscriber.getSubscribers(sender, BLOCKCHAIN[source]))
          .subscribersV2
        const approvedRecipients: string[] = payloadHelper.checkNotificationSetting(
          channelMeta.channel_settings,
          recipients,
          // TODO: rename it a parameter decided
          og_payload?.data?.index ?? null
        )
        convertedRecipients = this.filterUsingSubscriberNames(recipients, approvedRecipients)
      } else if (payloadType == PayloadType.SINGLE) {
        // Single recipient
        const subscriber = Container.get(Subscribers)
        const userSetting = await subscriber.getUserSetting(recipient, sender)
        if (!is_spam) {
          if (userSetting.result)
            convertedRecipients = [
              {
                subscriber: recipient.toLowerCase(),
                userSettings: userSetting.result,
                ts: userSetting.ts
              }
            ]
          else
            convertedRecipients = [
              {
                subscriber: recipient.toLowerCase(),
                userSettings: null,
                ts: userSetting.ts
              }
            ]
          const approvedRecipients: string[] = payloadHelper.checkNotificationSetting(
            channelMeta.channel_settings,
            convertedRecipients,
            // TODO: rename it a parameter decided
            og_payload?.data?.index ?? null
          )
          convertedRecipients = this.filterUsingSubscriberNames(
            convertedRecipients,
            approvedRecipients
          )
        } else {
          convertedRecipients = [
            {
              subscriber: recipient.toLowerCase(),
              userSettings: null,
              ts: null
            }
          ]
        }
      } else if (payloadType == PayloadType.SUBSET) {
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
            subscribed.push(subscribers[subscriberIndex].subscriber)
          } else {
            unsubscribed.push(user)
          }
        })
      } else {
        throw new Error('Invalid payloadType !!')
      }
      // END CHANNEL TYPE
    } else if (
      senderType === SenderType.W2W ||
      senderType === SenderType.PUSH_VIDEO ||
      senderType === SenderType.PUSH_SPACE
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

    /**
     * 4. ADD TO FEEDS TABLE
     */
    // Now we have feed_payload and users, so add to feeds
    const hidden = feed_payload?.data?.hidden
    const etime = feed_payload?.data?.etime
    // todo isSpam=isRecipientIn(subscribed)
    // currently spam is not supported

    const feedItem: FeedItem = new FeedItem()
    const recipientsWithLastUpdateTimestamp = convertedRecipients.map(
      (recipient) => <Recipient>{ addr: recipient.subscriber, ts: recipient.ts }
    )
    feedItem.header = <FHeader>{
      sender: sender,
      recipientsResolved: recipientsWithLastUpdateTimestamp,
      senderType: senderType,
      source: source
    }
    feedItem.payload = feed_payload
    feedItem.payload.data.sid = payloadId

    return feedItem
  }
}

/*
 Prepare original notificaiton
 let payload = {
  notification: {
    title: channel - title of notification, | channelMeta["name"] - ogPayload->notification->title | Trim on 50 chars
    body: msg of notification | ogPayload->notification->body | Trim on 180 chars
  },
  data: {
    sid: "", | Nothing at this stage, fill before processing feeds payload
    type: "1", | ogPayload -> data -> type
    app: "Binance", | channelMeta -> name | Trim to 40 chars
    icon: "https://backend.epns.io/someicon.jpg", | channelMeta -> icon
    url: "https://channelurl.com/",  | channelMeta -> icon
    appbot: "0", | static include but taken care by app
    secret: "somesecret" | ogPayload -> data -> secret | don't trim
    asub: "subject", | ogPayload -> data -> asub | Trim to 80 chars
    amsg: "message", | ogPayload -> data -> amsg | Trim to 500 chars
    acta: "https://somecta.com/", | ogPayload -> data -> acta | Omit if more than 255 chars
    aimg: "https://anyserver.com/someimage.jpg", | Omit if more than 255 chars
    hidden: "0", | static include but take care by app
    epoch: "", | Nothing at this stage, fill before processing feeds payload epoch time "1589659592", it's in seconds
  },
  recipients: {}
 }
*/

/*
{
    "data": {
        "app": "Lens Protocol",
        "sid": "2327003",
        "url": "https://lens.xyz/",
        "acta": "",
        "aimg": "",
        "amsg": "[b:paulbrainy] commented '[d:Yes Sir. ]' on your post: [s:null][timestamp: 1675099562]",
        "asub": "You have a new comment",
        "icon": "https://gateway.ipfs.io/ipfs/bafybeid",
        "type": 3,
        "epoch": "1675099563.046",
        "etime": null,
        "hidden": "0",
        "sectype": null
    },
    "recipients": {
        "0xc5c408ec4c61a905ce45d41162b83ef2e06fcca0": null
    },
    "notification": {
        "body": "You have a new comment from paulbrainy.",
        "title": "Lens Protocol - New comment"
    },
    "verificationProof": "eip712v2:0x39defb4dd6fd5c410f4ed6ff539d6195b1202b316ce336efe4d03ff536ac7f390f51c644b8f13d7a60a41b1e858669a4901fb37047f4ece8f9293522b57d788e1c::uid::9b7b281e-690b-491c-8de9-579081ed535d"
}
*/

interface PayloadIdentityInfo {
  success: boolean
  storageType: number
  storagePointer: string
}

export enum StorageType {
  EMBEDDED = 0,
  IPFS = 1,
  DIRECT_PAYLOAD = 2,
  SUBGRAPH = 3,
  CHAT = 4
}

export enum PayloadType {
  BROADCAST = 1, // send to everyone who is subscribed to the sender address
  SINGLE = 3, // send to a single address
  SUBSET = 4 // send to a list of addresses, checking vs a full list of group subscribers
  // a reasonable limit of 200-500 addresses should be used
}

// external version of a Payload Item
export class AddPayloadRequest {
  // ex: AAAZZ-AAAAA-BBBB
  id?: string
  // ex: eip712v2:0xFO00::uid::3F
  verificationProof: string
  // ex: eip155:1:0x6500
  sender: string
  // ex: eip155:1:0x0700
  recipient: string
  // ex: ETH_MAINNET
  source: string
  // ex: 2+{"title":"test", "body":"test2", "data":{"acta":"", "aimg":"","amsg":""}}
  identity: any
  validatorToken: string
}
