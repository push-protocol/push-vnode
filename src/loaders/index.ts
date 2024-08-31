import { Express } from 'express'
import { Server } from 'http'

import config from '../config'
import dbLoader from './db'
import dbListenerLoader from './dbListener'
import dependencyInjectorLoader from './dependencyInjector'
import expressLoader from './express'
import initializer from './initializer'
import ipfsLoader from './ipfsLoader'
import jobsLoader from './jobs'
import logger from './logger'
import redisLoader from './redis'
import pushSocketLoader from './socket'
import subGraphJobs from './subGraphJobs'
import initialiseSwagger from './swagger'
import { Container } from 'typedi'
import ChannelsService from '../services/channelsService'
import Alias from '../services/channelsCompositeClasses/aliasClass'
import Subscribers from '../services/channelsCompositeClasses/subscribersClass'
import Channel from '../services/channelsCompositeClasses/channelsClass'

export default async ({
  expressApp,
  server,
  testMode
}: {
  expressApp: Express
  server: Server
  testMode: boolean
}) => {
  logger.info('Loaders connected!')

  await ipfsLoader()
  logger.info('IPFS loaded!')

  const pool = await dbLoader()
  logger.info('Database connected!')

  logger.info('Redis loading!')
  await redisLoader()
  logger.info('Redis loaded!')

  // It returns the agenda instance because it's needed in the subsequent loaders
  await dependencyInjectorLoader({ testMode })
  logger.info('Dependency Injector loaded!')

  const alias = Container.get(Alias)
  const subscribers = Container.get(Subscribers)
  const channels = Container.get(Channel)

  const channelService = Container.get(ChannelsService)
  await channelService.postConstruct()

  logger.info('Running Initilizer')
  await initializer({ logger, testMode })
  logger.info('Initilizer completed!')

  logger.info('Loading DB Events listener')
  await dbListenerLoader({ pool, logger })
  logger.info('DB Listener loaded!')

  // logger.info('Loading jobs')
  // await jobsLoader({ logger })
  // logger.info('Jobs loaded!')

  if (config.pushNodesNet !== 'PROD') {
    logger.info('Loading Subgraph jobs')
    await subGraphJobs({ logger })
    logger.info('Subgrpah Jobs loaded!')
  }

  initialiseSwagger(expressApp as Express)
  logger.info('Swagger loaded!')

  expressLoader({ app: expressApp })
  logger.info('Express loaded!')

  if (!testMode) {
    await pushSocketLoader({ server })
    logger.info('Push Socket loaded!')
  }
}
