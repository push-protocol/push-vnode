// Do Scheduling
// https://github.com/node-schedule/node-schedule
// *    *    *    *    *    *
// ┬    ┬    ┬    ┬    ┬    ┬
// │    │    │    │    │    │
// │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
// │    │    │    │    └───── month (1 - 12)
// │    │    │    └────────── day of month (1 - 31)
// │    │    └─────────────── hour (0 - 23)
// │    └──────────────────── minute (0 - 59)
// └───────────────────────── second (0 - 59, OPTIONAL)
// Execute a cron job every 5 Minutes = */5 * * * *
// Starts from seconds = * * * * * *

import schedule from 'node-schedule'
import { Container } from 'typedi'
import { Logger } from 'winston'

import * as w2wMetaRepository from '../db-access/w2w/w2w-meta'
import AuthService from '../services/authService'
import Channel from '../services/channelsCompositeClasses/channelsClass'
import ChannelPrecache from '../services/channelsCompositeClasses/precacheChannel'
import ChannelsService from '../services/channelsService'
import ChatService from '../services/chatService'
import FeedsService from '../services/feedsService'
import HistoryFetcherService from '../services/historyFetcherService'
import PayloadsService from '../services/payloadsService'

export default ({ logger }: { logger: Logger }) => {
  // 1. PUSHTOKENS SERVICE
  // Schedule automatic deletion of servertokens
  logger.info('Scheduling automatic deletion of server tokens [Every 10 Mins]')
  schedule.scheduleJob('*/10 * * * *', async function () {
    const auth = Container.get(AuthService)
    const taskName = 'Server Tokens Deleted'

    try {
      await auth.deleteExpiredServerTokens()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 2. CHANNELS SERVICE
  // Schedule channels data population for unprocessed channels
  logger.info('Scheduling Channels Processing [Every 5 Mins]')
  schedule.scheduleJob('*/5 * * * *', async function () {
    const channels = Container.get(Channel)
    const taskName = 'Channels Data Processed'

    try {
      await channels.batchProcessChannelData()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 3. PAYLOADS SERVICE
  // Schedule payloads data population for unprocessed payloads
  logger.info('Scheduling Payloads Processing [Every 5 Mins]')
  schedule.scheduleJob('*/5 * * * *', async function () {
    const payloads = Container.get(PayloadsService)
    const taskName = 'Payloads Processed'

    try {
      await payloads.batchProcessPayloads()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 4. FEEDS SERVICE
  // Schedule payloads data population for unprocessed payloads
  logger.info('Scheduling Feeds Processing [Every 5 Mins]')
  schedule.scheduleJob('*/5 * * * *', async function () {
    const feeds = Container.get(FeedsService)
    const taskName = 'Feeds Processed'

    try {
      await feeds.batchProcessFeeds()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 5. CHANNELS SERVICE
  // Schedule channels alias data process
  logger.info('Scheduling Channels Alias Processing [Every 5 Mins]')
  schedule.scheduleJob('*/5 * * * *', async function () {
    const channels = Container.get(ChannelsService)
    const taskName = 'Channels Alias Data Processed'

    try {
      await channels.batchProcessAliasVerificationData()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 6. HISTORY FETCHER SERVICE
  // Schedule payloads data population for unprocessed payloads
  logger.info('Scheduling EPNS Protocol History Fetcher [Every 8 Hours]')
  const rule = new schedule.RecurrenceRule()
  rule.dayOfWeek = [0, new schedule.Range(0, 6)]
  rule.hour = 8
  rule.minute = 0

  schedule.scheduleJob(rule, async function () {
    const historyFetcher = Container.get(HistoryFetcherService)
    const taskName = 'Protocol History Processed'

    try {
      await historyFetcher.syncProtocolData(false)
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 7. FFEDS SERVICE
  // Schedule automatic deletion of expiredfeeds
  logger.info('Scheduling automatic deletion of expired feeds [Every 10 Minutes]')
  schedule.scheduleJob('*/10 * * * *', async function () {
    const feeds = Container.get(FeedsService)
    const taskName = 'Expired Feeds Deleted'

    try {
      await feeds.deleteExpiredFeeds()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 8. CHAT SERVICE
  // Schedule automatic IPFS flushing
  logger.info('Scheduling flush messages from file to IPFS [Every 60 Minutes]')
  schedule.scheduleJob('*/60 * * * *', async function () {
    const chat = Container.get(ChatService)
    const taskName = 'Flush messages from file to IPFS'

    try {
      await chat.batchUploadMessagesToIPFS()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 9. CHAT SERVICE
  // Schedule automatic deletion of expired groups
  logger.info('Scheduling clean up expired groups [Every 60 Minutes]')
  schedule.scheduleJob('*/60 * * * *', async function () {
    const chat = Container.get(ChatService)
    const taskName = 'Clean up expired groups'

    try {
      await chat.batchRemoveExpiredGroups()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 10. CHAT SERVICE
  // Schedule automatic spaces notification
  logger.info('Scheduling upcoming spaces notification [Every 5 Minutes]')
  schedule.scheduleJob('*/5 * * * *', async function () {
    const taskName = 'Notifications sent for upcoming Push Spaces'

    try {
      const chat = Container.get(ChatService)
      await chat.batchProcessUpcomingSpaceNotifcation()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 11. W2W SERVICE
  //update the status from "ACTIVE" to "ENDED" for records where schedule_at is less than or equal to 6 hours before the current time.
  logger.info('Scheduling ACTIVE spaces status to ENDED [Every 5 Minutes]')
  schedule.scheduleJob('*/5 * * * *', async function () {
    const taskName = 'End stale active spaces'

    try {
      await w2wMetaRepository.markSpacesEndedAfterSixHours()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 12. W2W SERVICE
  // status to "ENDED" for spaces that are in a "PENDING" state and have not started even 6 hours after the scheduled start time.
  logger.info('Scheduling PENDING spaces to ENDING [Every 5 Minutes]')
  schedule.scheduleJob('*/5 * * * *', async function () {
    const taskName = 'End pending spaces'

    try {
      await w2wMetaRepository.endPendingSpacesAfterSixHours()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })

  // 13. DELETE ALL precache channel details that haev exceeded 1 hr
  logger.info('Scheduling flush pre-cache channel entries [Every 60 Minutes]')
  schedule.scheduleJob('*/60 * * * *', async function () {
    const chat = Container.get(ChatService)
    const taskName = 'Flush pre-cache channel entries'
    const channelPrecache = Container.get(ChannelPrecache)
    try {
      await channelPrecache._bulkDeletePreChannelRecord()
      logger.info(`Cron Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Cron Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  })
}
