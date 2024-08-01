import * as db from '../../helpers/dbHelper'
import { IFeed, IFeedPayload, INotificaiton } from '../../interfaces/notification'

/**
 * GET FEEDS OF A CHANNEL
 * @param channel channel address in CAIP format
 * @param page page number
 * @param pageSize number of items per page
 * @param notificationType notification type 1 -> Broadcast | 3 -> target | 4 -> subset
 */
export async function getFeedsOfChannel(
  channel: string,
  page: number,
  pageSize: number,
  includeRaw: boolean,
  notificationType?: number
) {
  const offset = (page - 1) * pageSize

  let query = `SELECT payload_id, sender, epoch, feed_payload, source, etime 
  FROM feeds WHERE hidden = 0 AND channel = ?`
  // ADD NOTIFICATION_TYPE FILTER
  if (notificationType !== undefined) {
    // Modify the JSON path to access 'type' property inside 'data' property
    query += ` AND JSON_EXTRACT(feed_payload, "$.data.type") = ${notificationType} `
  }
  // ADD LIMIT AND OFFSET FILTER
  query += `ORDER BY epoch DESC LIMIT ${pageSize} OFFSET ${offset}`

  const feeds: IFeed[] = await new Promise((resolve, reject) => {
    ;(db as any).query(
      query,
      [channel, channel],
      function (
        err: any,
        results: {
          payload_id: number
          sender: string
          epoch: string
          source: string
          etime: string
          feed_payload: string
        }[]
      ) {
        if (err) {
          reject(err)
        } else {
          const feeds = results.map((row) => ({
            payloadId: row.payload_id,
            sender: row.sender,
            epoch: row.epoch,
            payload: JSON.parse(row.feed_payload) as IFeedPayload,
            source: row.source,
            etime: row.etime
          }))
          resolve(feeds)
        }
      }
    )
  })

  const notifications = await parseFeedToNotification(feeds, includeRaw)

  const total: number = await new Promise((resolve, reject) => {
    ;(db as any).query(
      `SELECT COUNT(*) AS total FROM feeds WHERE hidden = 0 AND channel = ?`,
      [channel],
      function (err: any, results: [{ total: number }]) {
        if (err) {
          reject(err)
        } else {
          resolve(results[0].total)
        }
      }
    )
  })

  return { notifications, total }
}

/**
 * PARSE FEEDS TO NOTIFICATION RESPONSE
 * @dev - This converter is mostly used to give out response and socket events to client now
 * @param feeds feed array
 * @param includeRaw
 */
export async function parseFeedToNotification(feeds: IFeed[], includeRaw: boolean = false) {
  const notificationType = {
    1: 'BROADCAST',
    3: 'TARGET',
    4: 'SUBSET'
  }

  const notifications: INotificaiton[] = feeds.map((feed) => {
    let recipients: string[]
    if (Array.isArray(feed.payload.recipients)) {
      recipients = feed.payload.recipients
    } else if (typeof feed.payload.recipients === 'string') {
      recipients = [feed.payload.recipients]
    } else {
      recipients = Object.keys(feed.payload.recipients)
    }

    const notification = {
      timestamp: feed.epoch,
      from: feed.sender,
      to: recipients,
      notifID: feed.payloadId,
      channel: {
        name: feed.payload.data.app,
        icon: feed.payload.data.icon,
        url: feed.payload.data.url
      },
      meta: {
        type: 'NOTIFICATION.' + notificationType[feed.payload.data.type]
      },
      message: {
        notification: {
          title: feed.payload.notification.title,
          body: feed.payload.notification.body
        },
        payload: {
          title: feed.payload.data.asub,
          body: feed.payload.data.amsg,
          cta: feed.payload.data.acta,
          embed: feed.payload.data.aimg,
          meta: {
            domain: feed.payload.data.additionalMeta?.domain || 'push.org',
            type: feed.payload.data.additionalMeta?.type,
            data: feed.payload.data.additionalMeta?.data
          }
        }
      },
      config: {
        expiry: feed.payload.data.etime,
        silent: feed.payload.data.silent === '1',
        hidden: feed.payload.data.hidden === '1'
      },
      source: feed.source
    }

    if (includeRaw) {
      ;(notification as any).raw = {
        verificationProof: feed.payload.verificationProof
      }
    }
    return notification
  })
  return notifications
}
