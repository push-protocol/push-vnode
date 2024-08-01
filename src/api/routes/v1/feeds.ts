import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../../config'
import { convertAddressToPartialCaip, convertCaipToAddress } from '../../../helpers/caipHelper'
import FeedsService from '../../../services/feedsService'
import { validateAddress } from '../../helpers/joiHelper'
import middlewares from '../../middlewares'
import feedsDeprecated from '../deprecated/feeds.deprecated'
import feedsInternal from '../internal/feeds.internal'

const route = Router()

export default (app: Router) => {
  // load deprecated routes
  feedsDeprecated(app)
  // load internal routes
  feedsInternal(app)

  // Load the actual external routes
  app.use(`/${config.api.version}/feeds`, route)
  app.use(errors())

  // to search for feeds
  route.post(
    '/search',
    celebrate({
      body: Joi.object({
        subscriber: Joi.string().required().custom(validateAddress), // subscriber's wallet address
        searchTerm: Joi.string().default(''), // string to search in notification body / title
        isSpam: Joi.number().default(0),
        filter: Joi.string().default('{}'),
        page: Joi.number().required(), // 1-indexed; not 0-indexed
        pageSize: Joi.number().required(),
        /*
          filter object (before stringification):
          {
            channels: array of wallet addresses (specific subscribed channels to search),
            date: { // if date range
                lowDate: string,
                highDate: string
              }
              // else string of single date
         */
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'read')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const feeds = Container.get(FeedsService)
        const response = await feeds.searchFeeds(
          convertAddressToPartialCaip(req.body.subscriber).result,
          req.body.searchTerm,
          req.body.isSpam,
          req.body.filter,
          req.body.page,
          req.body.pageSize
        )
        response.results.map((each) => (each.sender = convertCaipToAddress(each.sender).result))
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  // to get_feeds_between_time_range
  route.post(
    '/get_feeds_between_time_range',
    celebrate({
      body: Joi.object({
        startTime: Joi.number().required(),
        endTime: Joi.number().required(),
        page: Joi.number().required(),
        pageSize: Joi.number().required()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      try {
        const feeds = Container.get(FeedsService)
        const response = await feeds.getFeedsBetweenTimeRange(
          req.body.startTime,
          req.body.endTime,
          req.body.page,
          req.body.pageSize
        )

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
