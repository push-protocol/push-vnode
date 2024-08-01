import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
const route = Router()
import config from '../../../config'
import APIKeysService from '../../../services/apikeysService'
import middlewares from '../../middlewares'
import apikeysInternal from '../internal/apikeys.internal'

export default (app: Router) => {
  // load internal routes
  apikeysInternal(app)

  // Load the actual external routes
  app.use(`/${config.api.version}`, route)
  app.use(errors())

  route.post(
    '/api/keys',
    celebrate({
      body: Joi.object({
        validityInDays: Joi.number().min(1).default(1825).max(1825).required()
      })
    }),
    async (req, res, next) => {
      await middlewares.verifyToken(req, res, next)
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      try {
        const apiKeysService = Container.get(APIKeysService)
        const response = await apiKeysService.createAPIKey(req.body.validityInDays)
        return res.status(201).json(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  route.delete(
    '/api/keys',
    celebrate({
      body: Joi.object({
        apiKey: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.verifyToken(req, res, next)
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling delete /api/keys endpoint with body: %o', req.body)
      try {
        const apiKeysService = Container.get(APIKeysService)
        const response = await apiKeysService.deleteAPIKey(req.body.apiKey)
        return res.status(201).json(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )
}
