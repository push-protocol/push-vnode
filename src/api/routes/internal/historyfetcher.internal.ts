import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'

import HistoryFetcherService from '../../../services/historyFetcherService'
import middlewares from '../../middlewares'

const route = Router()

export default (app: Router) => {
  app.use('/historyfetcher', route)
  app.use(errors())

  // LOAD INTERNAL ROUTES

  // to get protocol meta
  route.post(
    '/_get_protocol_meta',
    celebrate({
      body: Joi.object({
        show_logs: Joi.bool(),
        blockchain: Joi.string().required()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug(
        'Calling /historyfetcher/_get_protocol_meta endpoint with body: %o',
        req.body,
        req.body.show_logs
      )

      try {
        const historyFetcher = Container.get(HistoryFetcherService)
        const response = await historyFetcher.getProtocolMeta(req.body.blockchain)

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to update protocol meta
  route.post(
    '/_update_protocol_meta',
    celebrate({
      body: Joi.object({
        data_1: Joi.string().required(),
        data_2: Joi.string().required(),
        data_3: Joi.string().required(),
        blockchain: Joi.string().required(),
        show_logs: Joi.bool()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /historyfetcher/_update_protocol_meta endpoint with body: %o', req.body)

      try {
        const historyFetcher = Container.get(HistoryFetcherService)
        const response = await historyFetcher.updateProtocolMeta(
          req.body.data_1,
          req.body.data_2,
          req.body.data_3,
          req.body.blockchain,
          req.body.show_logs
        )

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to sync protocol data
  route.post(
    '/_sync_protocol_data',
    celebrate({
      body: Joi.object({
        show_logs: Joi.bool()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /historyfetcher/_sync_protocol_data endpoint with body: %o', req.body)

      try {
        const historyFetcher = Container.get(HistoryFetcherService)
        const response = await historyFetcher.syncProtocolData(req.body.show_logs)

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to get channels history
  route.post(
    '/_get_channels_history',
    celebrate({
      body: Joi.object({
        from_block: Joi.number().required(),
        to_block: Joi.number().required(),
        show_logs: Joi.bool(),
        blockchain: Joi.string().required()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /historyfetcher/_get_channels_history endpoint with body: %o', req.body)

      try {
        const historyFetcher = Container.get(HistoryFetcherService)
        const response = await historyFetcher.getChannelsHistory(
          req.body.from_block,
          req.body.to_block,
          req.body.blockchain,
          req.body.show_logs
        )

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to sync channels history
  route.post(
    '/_sync_channels_data',
    celebrate({
      body: Joi.object({
        from_block: Joi.number().required(),
        to_block: Joi.number().required(),
        blockchain: Joi.string().required()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /historyfetcher/_sync_channels_data endpoint with body: %o', req.body)

      try {
        const historyFetcher = Container.get(HistoryFetcherService)
        const response = await historyFetcher.syncChannelsData(
          req.body.from_block,
          req.body.to_block,
          req.body.blockchain
        )

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to get subscribers history
  route.post(
    '/_get_subscribers_history',
    celebrate({
      body: Joi.object({
        from_block: Joi.number().required(),
        to_block: Joi.number().required(),
        blockchain: Joi.string().required(),
        show_logs: Joi.bool()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug(
        'Calling /historyfetcher/_get_subscribers_history endpoint with body: %o',
        req.body
      )

      try {
        const historyFetcher = Container.get(HistoryFetcherService)
        const response = await historyFetcher.getSubscribersHistory(
          req.body.from_block,
          req.body.to_block,
          req.body.blockchain,
          req.body.show_logs
        )

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to sync subscribers history
  route.post(
    '/_sync_subscribers_data',
    celebrate({
      body: Joi.object({
        from_block: Joi.number().required(),
        to_block: Joi.number().required(),
        blockchain: Joi.string().required(),
        show_logs: Joi.bool()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug(
        'Calling /historyfetcher/_sync_subscribers_data endpoint with body: %o',
        req.body
      )

      try {
        const historyFetcher = Container.get(HistoryFetcherService)
        const response = await historyFetcher.syncSubscribersData(
          req.body.from_block,
          req.body.to_block,
          req.body.blockchain,
          req.body.show_logs
        )

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to get notifications history
  route.post(
    '/_get_notifications_history',
    celebrate({
      body: Joi.object({
        from_block: Joi.number().required(),
        to_block: Joi.number().required(),
        blockchain: Joi.string().required(),
        show_logs: Joi.bool()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug(
        'Calling /historyfetcher/_get_notifications_history endpoint with body: %o',
        req.body
      )

      try {
        const historyFetcher = Container.get(HistoryFetcherService)
        const response = await historyFetcher.getNotificationsHistory(
          req.body.from_block,
          req.body.to_block,
          req.body.blockchain,
          req.body.show_logs
        )

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to sync notifications history
  route.post(
    '/_sync_notifications_data',
    celebrate({
      body: Joi.object({
        from_block: Joi.number().required(),
        to_block: Joi.number().required(),
        blockchain: Joi.string().required(),
        show_logs: Joi.bool()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug(
        'Calling /historyfetcher/_sync_notifications_data endpoint with body: %o',
        req.body
      )

      try {
        const historyFetcher = Container.get(HistoryFetcherService)
        const response = await historyFetcher.syncNotificationsData(
          req.body.from_block,
          req.body.to_block,
          req.body.blockchain,
          req.body.show_logs
        )

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
