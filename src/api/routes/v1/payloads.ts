import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../../config'
import { VIDEO_NOTIFICATION_ACCESS_TYPE } from '../../../enums/video'
import { convertCaipToAddress } from '../../../helpers/caipHelper'
import { isValidNFTAddress, isValidSCWAddress } from '../../../helpers/chatHelper'
import PayloadsService from '../../../services/payloadsService'
import payloadsDeprecated from '../deprecated/payloads.deprecated'
import payloadsInternal from '../internal/payloads.internal'
const route = Router()
const SOURCE_TYPE =
  config.pushNodesNet == 'STAGING'
    ? [...config.supportedSourceTypes, 'SIMULATE']
    : config.supportedSourceTypes

export default (app: Router) => {
  // load deprecated routes
  payloadsDeprecated(app)
  // load internal routes
  payloadsInternal(app)

  // Load the rest
  app.use(`/${config.api.version}/payloads`, route)
  app.use(errors())

  // to add an external payload
  route.post(
    '/',
    celebrate({
      body: Joi.object({
        verificationProof: Joi.string().required(),
        sender: Joi.string().required(),
        recipient: Joi.string().required(),
        source: Joi.string()
          .required()
          .valid(...SOURCE_TYPE),
        identity: Joi.string().required(),
        rules: Joi.object({
          access: {
            type: Joi.string()
              .valid(...Object.values(VIDEO_NOTIFICATION_ACCESS_TYPE))
              .required(),
            data: {
              chatId: Joi.string().optional()
            }
          }
        })
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const payloads = Container.get(PayloadsService)

        let recipient = null
        if (isValidNFTAddress(req.body.recipient) || isValidSCWAddress(req.body.recipient)) {
          recipient = req.body.recipient
        } else {
          const { result: result, err: recipientError } = convertCaipToAddress(req.body.recipient)
          recipient = 'eip155:' + result
        }

        const response = await payloads.addExternalPayload(
          req.body.verificationProof,
          req.body.sender,
          req.body.source === config.videoId
            ? config.senderType.pushVideo
            : config.senderType.channel,
          recipient,
          req.body.source,
          req.body.identity,
          req.body.rules
        )
        return res.status(204).send()
      } catch (e) {
        Logger.error('🔥 error while adding payload: %o', e)
        return next(e)
      }
    }
  )
}
