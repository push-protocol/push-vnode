import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'

import config from '../../../config'
import PayloadsService from '../../../services/payloadsService'
import { validateAddress } from '../../helpers/joiHelper'
import middlewares from '../../middlewares'

const route = Router()
const SOURCE_TYPE = config.supportedSourceTypes

export default (app: Router) => {
  app.use('/payloads', route)
  app.use(errors())

  // LOAD INTERNAL ROUTES

  // to process a selected payload for recieving info
  route.post(
    '/_process_payload',
    celebrate({
      body: Joi.object({
        id: Joi.number().required(),
        channel: Joi.string().required().custom(validateAddress),
        recipient: Joi.string().required().custom(validateAddress),
        storageType: Joi.string().required(),
        storagePointer: Joi.string().required(),
        payload: Joi.object(),
        use_push: Joi.boolean().required(),
        source: Joi.string()
          .required()
          .valid(...SOURCE_TYPE),
        is_spam: Joi.number().required()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /payloads/_process_payload endpoint with body: %o', req.body)
      try {
        const payloads = Container.get(PayloadsService)
        const { success, id, feed_payload } = await payloads.processPayload(
          req.body.id,
          req.body.channel,
          req.body.recipient,
          req.body.storageType,
          req.body.storagePointer,
          req.body.payload,
          req.body.use_push,
          req.body.source,
          req.body.is_spam
        )

        return res.status(201).json({ success, id, feed_payload })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to batch process the entire unprocessed payloads to a certain limit
  route.post(
    '/_batch_process_payloads',
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /payloads/_batch_process_payloads endpoint with body: %o', req.body)
      try {
        const payloads = Container.get(PayloadsService)
        const { success } = await payloads.batchProcessPayloads()

        return res.status(201).json({ success })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
