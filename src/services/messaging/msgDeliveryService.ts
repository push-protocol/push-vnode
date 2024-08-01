import { Service } from 'typedi'
import { Logger } from 'winston'
import { EventDispatcher, EventDispatcherInterface } from '../../decorators/eventDispatcher'
import payloader from '../../helpers/payloadHelper'
import { PushSocket } from '../../api/sockets/pushsocket'
import config from '../../config'
import { getProtocolMetaValues, updateProtocolMetaValues } from '../../helpers/protocolMetaHelper'
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { FPayload } from '../messaging-common/messageBlock'
import { WinstonUtil } from '../../utilz/winstonUtil'

const snsClient = new SNSClient({
  credentials: {
    accessKeyId: process.env.SNS_AWS_ACCESS_KEY,
    secretAccessKey: process.env.SNS_AWS_SECRET_KEY
  },
  region: process.env.SNS_AWS_REGION
})

/*
Our core notification distribution logic packed from feeds.ts
Main goals:
  - send notifications via Amazon SNS (for Hackers)
  - send notification via WebSockets (dApp)
  - send notifications via DeliveryNodes (normal flow, for partners)
Delivery nodes can be hosted by PUSH or by a 3rd party.

NOTE: methods names are intentionally like in feedService.ts
 */
@Service()
export class MsgDeliveryService {
  public log: Logger = WinstonUtil.newLog(MsgDeliveryService)
  constructor(@EventDispatcher() private eventDispatcher: EventDispatcherInterface) {}

  // send to delivery nodes
  public async processFeed(
    payloadId: string,
    users: string[],
    feed_payload: FPayload,
    sender: string
  ) {
    this.log.debug(
      'Trying to retrieve and process feed for payloadId: %s | prepared payload: %o',
      payloadId,
      feed_payload
    )
    let valid = true
    let err = ''
    feed_payload = payloader.modifyFeedPayloadForAWSSNS(feed_payload, payloadId)
    const deliveryNodeFeedItem = {
      sid: payloadId, // TODO payloadId is string now; TESTING REQUIRED
      payload_id: payloadId,
      users: users,
      payload: feed_payload,
      epoch: feed_payload.data.epoch
    }
    const deliveryNodes = PushSocket.getDeliveryNodes()
    const feedEvent = PushSocket.getFeedEvent()
    // todo WARNING: this does not work as intended
    //  1 the code does not block ;
    //  2 publishFeedToSNS executes before deliveryNodes get notified , even when delivery fails
    deliveryNodes.forEach(async (each) => {
      try {
        await feedEvent.sendLiveFeeds(each.socket.id, deliveryNodeFeedItem)
        this.log.info('Completed processFeed()')
        return
      } catch (e) {
        valid = false
        this.log.error(e)
        err = e
      }
    })
    await this.publishFeedToSNS(payloadId, users, feed_payload, sender)
  }

  // send to SNS queue
  private async publishFeedToSNS(payloadId: string, users, feedPayload, sender) {
    if (config.SNS_INTEGRATION_ENABLED == 'false') {
      return
    }
    const key = `awsSNSPublishLatestEpoch`
    const offsetPadding = 6
    const protocolSyncBlocks = await getProtocolMetaValues([key], offsetPadding, this.log)
    if (protocolSyncBlocks[key] && feedPayload.data.epoch < parseInt(protocolSyncBlocks[key])) {
      this.log.info(
        'awsSNSPublishLatestEpoch is ahead of the feed epoch hence skipping feed with sid :: ' +
          payloadId
      )
      return
    }
    // todo DBQUERY
    await updateProtocolMetaValues(
      [{ type: key, value: feedPayload.data.epoch.toString() }],
      offsetPadding,
      this.log
    )
    const snsFeedItem = {
      sid: payloadId, // todo this is string now; TESTING REQUIRED;
      sender: sender,
      users: JSON.parse(users),
      payload: feedPayload,
      epoch: feedPayload.data.epoch,
      topic: 'Notification',
      subtopic: 'Channel'
    }
    const params = {
      Message: JSON.stringify(snsFeedItem),
      TopicArn: config.SNS_AWS_TOPIC_ARN
    }
    try {
      const data = await snsClient.send(new PublishCommand(params))
      this.log.debug(
        'publish to SNS success for the feed of sid :: %o, response: %o',
        payloadId,
        JSON.stringify(data)
      )
    } catch (err) {
      this.log.error('publish to SNS failed for the feed of sid :: %o', payloadId)
      this.log.error(err)
      throw err
    }
  }

  public async sendSpamEvent(
    payloadId: string,
    sender: string,
    senderType: number,
    users: string[],
    feed_payload: FPayload,
    source: string,
    is_spam: boolean,
    hidden: string,
    etime: string,
    did: string
  ) {
    const log = this.log
    const clientSocketFeedItem = {
      payload_id: payloadId, // ex: 1941678; todo changed this to string; TESTING REQUIRED
      sender: sender, // ex: eip155:80001:0x7058
      epoch: feed_payload?.data?.epoch, // ex: 1675099563.046
      payload: feed_payload, // { data: {}, recipients: [], notification: [], verificationProof: ""}
      source: source
    }
    const clients = PushSocket.getClients()
    const targetEvent = PushSocket.getTargetEvent()
    // todo slow + inefficient + won't scale
    // todo 1. this will break as soon as we'll get multiple node instances
    // todo 2. if there are 50k sockets online - for each is slow - and should be async
    // todo 3. in case target addresses (users[]) has 70k target addresse, the .contains() is a painful process
    for (const each of clients) {
      if (users.includes(each.address.toLowerCase())) {
        targetEvent.sendSingleTargetedSpam(each.socket.id, clientSocketFeedItem)
        log.info(
          `Spam Event sent to User -  address : ${each.address} PushSocket ID : ${each.socket.id}`
        )
      }
    }
  }
}
