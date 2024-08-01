import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'

import { convertAddressToPartialCaip, convertCaipToAddress } from '../../../helpers/caipHelper'
import FeedsService from '../../../services/feedsService'
import { validateAddress } from '../../helpers/joiHelper'
import middlewares from '../../middlewares'
import { deprecationNotice } from '../../middlewares/deprecationNotice'

const route = Router()

export default (app: Router) => {
  // Load all deprecated routes
  app.use('/feeds', route)
  app.use(errors())

  // all deprecated ones
  route.post(
    '/_get_spam_feeds',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        user: Joi.string().required().custom(validateAddress),
        page: Joi.number().required(),
        pageSize: Joi.number().required(),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'read')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /feeds/_get_spam_feeds endpoint with body: %o', req.body.user)

      try {
        const feeds = Container.get(FeedsService)
        const response = await feeds.getSpamFeeds(
          convertAddressToPartialCaip(req.body.user).result,
          req.body.page,
          req.body.pageSize
        )
        response.feeds.map((each) => (each.sender = convertCaipToAddress(each.sender).result))
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  // @desc      Get Feeds for a particular user with pagination
  // @body      user,page,pageSize,op
  // @route     POST /apis/feeds/get_feeds
  // @access    Public

  route.post(
    '/get_feeds',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        user: Joi.string().required(),
        page: Joi.number().required(),
        pageSize: Joi.number().required(),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'read')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /feeds/get_feeds endpoint with body: %o', req.body.user)

      try {
        const feeds = Container.get(FeedsService)
        const response = await feeds.getFeeds(
          convertAddressToPartialCaip(req.body.user).result,
          req.body.page,
          req.body.pageSize
        )
        response.feeds.map((each) => (each.sender = convertCaipToAddress(each.sender).result))
        return res.status(200).send({ results: response.feeds })
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  route.post(
    '/get_spam_feeds',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        user: Joi.string().required(),
        page: Joi.number().required(),
        pageSize: Joi.number().required(),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'read')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /feeds/get_spam_feeds endpoint with body: %o', req.body.user)

      try {
        const feeds = Container.get(FeedsService)
        const response = await feeds.getSpamFeeds(
          convertAddressToPartialCaip(req.body.user).result,
          req.body.page,
          req.body.pageSize
        )
        response.feeds.map((each) => (each.sender = convertCaipToAddress(each.sender).result))
        return res.status(200).send({ results: response.feeds })
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )
}
