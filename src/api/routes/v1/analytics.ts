import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
const route = Router()
import { Logger } from 'winston'

import config from '../../../config'
import AnalyticsService from '../../../services/analyticsService'
import middlewares from '../../middlewares'
import analyticsInternal from '../internal/analytics.internal'

const SOURCE_TYPE = config.supportedSourceTypes

export default (app: Router) => {
  //load internal routes
  analyticsInternal(app)

  // Load the actual external routes
  app.use(`/${config.api.version}/analytics`, route)
  app.use(errors())

  const analytics = Container.get(AnalyticsService)

  //get channel related analytics
  route.get(
    '/channel',
    celebrate({
      query: Joi.object({
        endDate: Joi.date().default(new Date()),
        startDate: Joi.date().default(new Date('2022-01-01')),
        source: Joi.string()
          .default(SOURCE_TYPE[0])
          .valid(...SOURCE_TYPE)
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const response = await analytics.channelAnalytics(
          req.query.startDate,
          req.query.endDate,
          req.query.source
        )
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  route.get(
    '/subscriber',
    celebrate({
      query: Joi.object({
        endDate: Joi.date().default(new Date()),
        startDate: Joi.date().default(new Date('2022-01-01')),
        channel: Joi.string().default('All'),
        source: Joi.string()
          .valid(...SOURCE_TYPE, 'All')
          .default('All')
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const response = await analytics.subscriberAnalytics(
          req.query.startDate,
          req.query.endDate,
          req.query.channel,
          req.query.source
        )
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  route.get(
    '/notification',
    celebrate({
      query: Joi.object({
        endDate: Joi.date().default(new Date()),
        startDate: Joi.date().default(new Date('2022-01-01')),
        channel: Joi.string().default('All'),
        source: Joi.string()
          .valid(...SOURCE_TYPE, 'All')
          .default('All'),
        spam: Joi.boolean().default('All')
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const response = await analytics.notificationAnalytics(
          req.query.startDate,
          req.query.endDate,
          req.query.channel,
          req.query.source,
          req.query.spam
        )
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  route.get(
    '/leaderboard',
    celebrate({
      query: Joi.object({
        limit: Joi.number().default(5).min(1).max(30),
        sort: Joi.string().default('subscribers').valid('subscribers', 'created'),
        order: Joi.string().default('desc').valid('asc', 'desc')
      })
    }),
    async (req: Request, res: Response) => {
      const Logger: Logger = Container.get('logger')
      try {
        const response = await analytics.leaderboardAnalytics(
          req.query.limit,
          req.query.sort,
          req.query.order
        )

        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  route.get('/chat/users', analytics.getChatTotalUsers)
  route.get('/chat/chats', analytics.getChatTotalMessages)

  route.get('/governance_data', async (req: Request, res: Response) => {
    const Logger = Container.get('logger')
    try {
      const response = await analytics.fetchGovernanceData()

      return res.status(200).send(response)
    } catch (error) {
      Logger.error('🔥 error: %o', error)
    }
  })

  route.post(
    '/governance_data',
    celebrate({
      body: Joi.object({
        governance_data: Joi.object().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.verifyToken(req, res, next)
    },
    async (req: Request, res: Response) => {
      const Logger = Container.get('logger')
      try {
        const response = await analytics.upsertGovernanceData(
          JSON.stringify(req.body.governance_data)
        )
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )
}
