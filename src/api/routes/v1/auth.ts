import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
const route = Router()
import { Logger } from 'winston'

import config from '../../../config'
import authInternal from '../internal/auth.internal'
const jwt = require('jsonwebtoken')

export default (app: Router) => {
  // load internal routes
  authInternal(app)

  // Load the actual external routes
  app.use(`/${config.api.version}`, route)
  app.use(errors())

  // Get list of all subscriptions of the the user
  route.post(
    '/login',
    celebrate({
      body: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        if (
          req.body.username === config.DEFAULT_AUTH_USERNAME &&
          req.body.password === config.DEFAULT_AUTH_PASSWORD
        ) {
          const token = jwt.sign(
            {
              user: config.DEFAULT_AUTH_USERNAME
            },
            process.env.TOKEN_KEY,
            {
              expiresIn: '24h'
            }
          )
          res.status(200).json({
            token: token
          })
        } else {
          res.status(401).send({
            message: 'Invalid Credentials'
          })
        }
      } catch (error) {
        Logger.error('🔥 Error in calling /login endpoint with error: %o', error)
        return next(error)
      }
    }
  )
}
