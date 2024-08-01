import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../../config'
import { isValidPartialCAIP10Address } from '../../../helpers/caipHelper'
import PushTokensService from '../../../services/pushTokensService'
import pushtokensDeprecated from '../deprecated/pushtokens.deprecated'

const request = require('request')

const route = Router()

export default (app: Router) => {
  pushtokensDeprecated(app)

  // Load the rest
  app.use(`/${config.api.version}/pushtokens`, route)
  app.use(errors())

  // Register Device Token
  route.post(
    '/register',
    celebrate({
      body: Joi.object({
        wallet: Joi.string().required(),
        device_token: Joi.string().required(),
        platform: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const pushInstance = Container.get(PushTokensService)
        if (isValidPartialCAIP10Address(req.body.wallet)) {
          const { success } = await pushInstance.registerDevice(
            req.body.wallet,
            req.body.device_token,
            req.body.platform
          )

          try {
            const options = {
              method: 'POST',
              url: config.DELIVERY_NODE_URL + '/apis/v1/pushtokens/register',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                device_token: req.body.device_token,
                platform: req.body.platform,
                wallet: req.body.wallet
              })
            }
            request(options, function (error, response) {
              if (error) {
                Logger.error(error)
              }
              Logger.info(response)
            })
          } catch (e) {
            Logger.error(
              '🔥 Error while calling delivery node v1/pushtokens/register endpoint: %o',
              e
            )
          }
          return res.status(204).json()
        } else {
          return next(new Error('Invalid wallet format'))
        }
      } catch (e) {
        Logger.error('🔥 Error while calling v1/pushtokens/register endpoint: %o', e)
        return next(e)
      }
    }
  )

  route.delete(
    '/',
    celebrate({
      body: Joi.object({
        walletAddress: Joi.string().required(),
        deviceToken: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const pushInstance = Container.get(PushTokensService)
        if (isValidPartialCAIP10Address(req.body.wallet)) {
          const { success } = await pushInstance.deleteWalletAndDevice(
            req.body.walletAddress,
            req.body.device_token
          )
          return res.status(204).json()
        } else {
          return next(new Error('Invalid wallet format'))
        }
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
