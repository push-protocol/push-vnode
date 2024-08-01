import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'

import config from '../../../config'
import { convertAddressToCaip } from '../../../helpers/caipHelper'
import * as epnsAPIHelper from '../../../helpers/epnsAPIHelper'
import PayloadsService from '../../../services/payloadsService'
import { validateAddress } from '../../helpers/joiHelper'
import middlewares from '../../middlewares'
import { deprecationNotice } from '../../middlewares/deprecationNotice'

const route = Router()
const SOURCE_TYPE = config.supportedSourceTypes

export default (app: Router) => {
  // Load only deprecated routes
  app.use('/payloads', route)
  app.use(errors())

  // deprecated but present since backend sdk supports it
  // @desc      //// DEPRECATED - Add a payload manually, re-routes to /payloads/add
  // @body      channel,recipient,payload,op
  // @route     POST /apis/payloads/add_manual_payload
  // @access    Public
  route.post(
    '/add_manual_payload',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        signature: Joi.string().required(),
        channel: Joi.string().required().custom(validateAddress),
        recipient: Joi.string().required().custom(validateAddress),
        chainId: Joi.string().required(),
        type: Joi.string().required(),
        deployedContract: Joi.string(),
        op: Joi.string().default('read'),
        payload: Joi.object().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /payloads/add_manual_payload endpoint with body: %o', req.body)
      try {
        const payloads = Container.get(PayloadsService)
        if (req.body.channel && req.body.recipient) {
          const sender = convertAddressToCaip(req.body.channel, req.body.chainId)
          const response = await payloads.addExternalPayload(
            'eip712v1:' + req.body.signature + '::uid::' + Date.now().toString(), // this becomes verification proof
            sender, // this becomes sender
            config.senderType.channel, // this becomes sender type
            'eip155:' + req.body.recipient,
            config.MAP_ID_TO_BLOCKCHAIN[parseInt(req.body.chainId)], // this becomes source
            '2+' + JSON.stringify(req.body.payload) // this becomes identity
          )
          return res.status(200).send(response)
        } else {
          return next(new Error('Invalid channel and recipient'))
        }
      } catch (e) {
        Logger.error('🔥 error while adding payload: %o', e)
        return next(e)
      }
    }
  )

  //
  route.post(
    '/_verify_signed_payload',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        message: Joi.object().required(),
        signature: Joi.string().required(),
        walletAddress: Joi.string().required().custom(validateAddress),
        deployedContract: Joi.string().required(),
        chainId: Joi.string().required(),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'verify')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /payloads/_verify_signed_payload endpoint with body: %o', req.body)
      try {
        // const payloads = Container.get(PayloadsService);
        const response = await epnsAPIHelper.verifySignedMessage(
          req.body.message,
          req.body.signature,
          req.body.walletAddress,
          req.body.deployedContract,
          req.body.chainId
        )
        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
