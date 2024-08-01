import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../../config'
import EmailService from '../../../services/emailService'
import middlewares from '../../middlewares'
import mailingInternal from '../internal/mailing.internal'

const route = Router()

export default (app: Router) => {
  // load internal routes
  mailingInternal(app)

  // Load the rest
  app.use(`/${config.api.version}/mailing`, route)
  app.use(errors())

  // to send mail out
  route.post(
    '/send',
    celebrate({
      body: Joi.object({
        from: Joi.string().required(),
        name: Joi.string().required(),
        topic: Joi.string().required(),
        sub: Joi.string().required(),
        msg: Joi.string().required()
      })
    }),
    middlewares.onlyTrustedSource,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const email = Container.get(EmailService)
        const { success, msg } = await email.sendMailSES(
          req.body.from,
          req.body.name,
          req.body.topic,
          req.body.sub,
          req.body.msg
        )

        return res.status(204).json()
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
