// Based on the brilliant work of: https://github.com/rodrigogs/mysql-events

import { Container } from 'typedi'

import config from '../config'
const MySQLEvents = require('@rodrigogs/mysql-events')

import Channel from '../services/channelsCompositeClasses/channelsClass'
import ChannelsService from '../services/channelsService'
import FeedsService from '../services/feedsService'
import PayloadsService from '../services/payloadsService'
import subGraphJobs from './subGraphJobs'

export default async ({ pool, logger }) => {
  const instance = new MySQLEvents(pool, {
    startAtEnd: true
  })
  const response = await instance.start()
  // EXAMPLE
  // dbEvents.addTrigger({
  //   name: 'Whole database instance',
  //   expression: '*',
  //   statement: MySQLEvents.STATEMENTS.ALL,
  //   onEvent: (event) => {
  //     console.log("Some Event");
  //     console.log(event);
  //   },
  // });

  // ALL EVENTS FUNCTIONS HERE | NEEDS TO BE ASYNC
  // 1. Channels Batch Process
  async function triggerBatchProcessChannels(event, logger) {
    const channels = Container.get(Channel)
    const taskName = 'Channels Data Processed'

    try {
      await channels.batchProcessChannelData()
      logger.info(`Event Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Event Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  }

  async function triggerBatchProcessAliasChannels(event, logger) {
    const channels = Container.get(ChannelsService)
    const taskName = 'Alias Data Processed'

    try {
      await channels.batchProcessAliasVerificationData()
      logger.info(`Event Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Event Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  }

  async function triggerGraphCronTaskLoader(event, logger) {
    const taskName = 'Channels Subgraph Added'

    try {
      await subGraphJobs({ logger })
      logger.info(`Event Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Event Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  }

  // 2. Payloads Batch Process
  async function triggerBatchProcessPayloads(event, logger) {
    const payloads = Container.get(PayloadsService)
    const taskName = 'Payloads Processed'

    try {
      await payloads.batchProcessPayloads()
      logger.info(`Event Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Event Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  }

  // 3. Feeds Batch Process
  async function triggerBatchProcessFeeds(event, logger) {
    const feeds = Container.get(FeedsService)
    const taskName = 'Feeds Processed'

    try {
      await feeds.batchProcessFeeds()
      logger.info(`Event Task Completed -- ${taskName}`)
    } catch (err) {
      logger.error(`Event Task Failed -- ${taskName}`)
      logger.error(`Error Object: %o`, err)
    }
  }

  // ALL EVENTS HERE
  // 1. CHANNELS SERVICE
  // Listen to Channels Service for Incoming Data
  logger.info(`Started Listening | INSERT | ${config.dbname}.channels.*`)
  instance.addTrigger({
    name: 'CHANNELS_INSERT',
    expression: `${config.dbname}.channels.*`,
    statement: MySQLEvents.STATEMENTS.INSERT,
    onEvent: async (event: any) => {
      logger.info(
        'DB Event: %s | %s -- %o | [%s]',
        event.type,
        event.schema + '.' + event.table,
        event.affectedColumns,
        new Date(event.timestamp).toLocaleString()
      )

      await triggerBatchProcessChannels(event, logger)
    }
  })

  logger.info(`Started Listening | UPDATE | ${config.dbname}.channels.identity`)
  instance.addTrigger({
    name: 'CHANNELS_UPDATE_IDENTITY',
    expression: `${config.dbname}.channels.identity`,
    statement: MySQLEvents.STATEMENTS.UPDATE,
    onEvent: async (event: any) => {
      logger.info(
        'DB Event: %s | %s -- %o | [%s]',
        event.type,
        event.schema + '.' + event.table,
        event.affectedColumns,
        new Date(event.timestamp).toLocaleString()
      )

      await triggerBatchProcessChannels(event, logger)
    }
  })

  logger.info(`Started Listening | INSERT | ${config.dbname}.channels.alias_verification_event`)
  instance.addTrigger({
    name: 'ALIAS_VERFICATION_EVENT_UPDATE',
    expression: `${config.dbname}.channels.alias_verification_event`,
    statement: MySQLEvents.STATEMENTS.UPDATE,
    onEvent: async (event: any) => {
      logger.info(
        'DB Event: %s | %s -- %o | [%s]',
        event.type,
        event.schema + '.' + event.table,
        event.affectedColumns,
        new Date(event.timestamp).toLocaleString()
      )

      await triggerBatchProcessAliasChannels(event, logger)
    }
  })

  logger.info(`Started Listening | UPDATE | ${config.dbname}.channels.processed`)
  instance.addTrigger({
    name: 'CHANNELS_UPDATE_PROCESSED',
    expression: `${config.dbname}.channels.processed`,
    statement: MySQLEvents.STATEMENTS.UPDATE,
    onEvent: async (event: any) => {
      logger.info(
        'DB Event: %s | %s -- %o | [%s]',
        event.type,
        event.schema + '.' + event.table,
        event.affectedColumns,
        new Date(event.timestamp).toLocaleString()
      )

      await triggerGraphCronTaskLoader(event, logger)
    }
  })

  logger.info(`Started Listening | UPDATE | ${config.dbname}.channels.sub_graph_id`)
  instance.addTrigger({
    name: 'CHANNELS_SUBGRAPH_ADDED',
    expression: `${config.dbname}.channels.sub_graph_id`,
    statement: MySQLEvents.STATEMENTS.UPDATE,
    onEvent: async (event: any) => {
      logger.info(
        'DB Event: %s | %s -- %o | [%s]',
        event.type,
        event.schema + '.' + event.table,
        event.affectedColumns,
        new Date(event.timestamp).toLocaleString()
      )

      await triggerGraphCronTaskLoader(event, logger)
    }
  })

  instance.on(MySQLEvents.EVENTS.CONNECTION_ERROR, console.error)
  // instance.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);
}
