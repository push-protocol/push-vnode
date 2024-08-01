import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../../config'
import InternalsService from '../../../services/internalsService'
import middlewares from '../../middlewares'
import internalsInternal from '../internal/internals.internal'

const route = Router()

export default (app: Router) => {
  // load internal routes
  internalsInternal(app)

  // Load the actual external routes
  app.use('/internals', route)
  app.use(errors())

  // testing restricted api call, will take a decision later after devtools
  route.post(
    `/${config.api.version}/_testRestrictedAPICall`,
    celebrate({
      body: Joi.object({})
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const internals = Container.get(InternalsService)
        const response = await internals._createDeleteChannel()

        return res.status(204).json()
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
