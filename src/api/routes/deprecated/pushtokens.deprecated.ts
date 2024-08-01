import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../../config'
import { isValidPartialCAIP10Address } from '../../../helpers/caipHelper'
import PushTokensService from '../../../services/pushTokensService'
import middlewares from '../../middlewares'
import { deprecationNotice } from '../../middlewares/deprecationNotice'
const request = require('request')

const route = Router()

export default (app: Router) => {
  app.use('/pushtokens', route)
  app.use(errors())

  // Register Device Token
  route.post(
    '/register_no_auth',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        op: Joi.string().required(),
        wallet: Joi.string().required(),
        device_token: Joi.string().required(),
        platform: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'register')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      Logger.debug('Calling /pushtokens/register_no_auth endpoint with body: %o', req.body)

      let wallet = req.body.wallet
      if (!isValidPartialCAIP10Address(wallet)) {
        wallet = 'eip155:' + wallet.toLowerCase()
      }

      try {
        const pushInstance = Container.get(PushTokensService)
        const { success } = await pushInstance.registerDevice(
          wallet,
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
              wallet: wallet
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

        return res.status(201).json({ success })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
