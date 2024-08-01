import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'

import FeedsService from '../../../services/feedsService'
import middlewares from '../../middlewares'

const route = Router()

export default (app: Router) => {
  app.use('/feeds', route)
  app.use(errors())

  // LOAD INTERNAL ROUTES

  // to add an incoming feed
  route.post(
    '/_add',
    celebrate({
      body: Joi.object({
        payload_id: Joi.string().required(),
        sender: Joi.string().required(),
        channel: Joi.string().required(),
        users: Joi.array().required(),
        feed_payload: Joi.object().required(),
        use_push: Joi.boolean().required(),
        blockchain: Joi.string().required(),
        is_spam: Joi.number().required(),
        hidden: Joi.boolean(),
        etime: Joi.number()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      Logger.debug('Calling /feeds/_add endpoint with body: %o', req.body)
      try {
        const feeds = Container.get(FeedsService)
        const { success } = await feeds.addFeed(
          req.body.payload_id,
          req.body.sender,
          req.body.channel,
          req.body.users,
          req.body.feed_payload,
          req.body.use_push,
          req.body.blockchain,
          req.body.is_spam,
          req.body.hidden,
          req.body.etime
        )

        return res.status(201).json({ success })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to delete expired feeds
  route.post(
    '/_delete_expired_feeds',
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      Logger.debug('Calling /feeds/_delete_expired_feeds endpoint with body: %o', req.body)
      try {
        const feeds = Container.get(FeedsService)
        const { success } = await feeds.deleteExpiredFeeds()

        return res.status(201).json({ success })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
