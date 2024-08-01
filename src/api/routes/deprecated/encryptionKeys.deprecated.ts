import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'

import EncryptionKeyService from '../../../services/encryptionKeyService'
import { validateAddress } from '../../helpers/joiHelper'
import middlewares from '../../middlewares'
import { deprecationNotice } from '../../middlewares/deprecationNotice'

const route = Router()

export default (app: Router) => {
  // Load all deprecated routes
  app.use('/encryptionKey', route)
  app.use(errors())

  // Haven't decided on them
  // Register Encyption key
  route.post(
    '/_register',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        address: Joi.string().required().custom(validateAddress),
        encryptionKey: Joi.string().required(),
        signature: Joi.string().required(), // to verify user hold this address
        op: Joi.string().required(),
        message: Joi.object().required(),
        chainId: Joi.number().required(),
        contractAddress: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'write')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /encryption_key/_register endpoint with body: %o', req.body)
      try {
        const encryptionKeyInstance = Container.get(EncryptionKeyService)
        const { success } = await encryptionKeyInstance.register(
          req.body.encryptionKey,
          req.body.address.toLowerCase(),
          req.body.signature,
          req.body.message,
          req.body.chainId,
          req.body.contractAddress
        )

        return res.status(201).json({ success })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  //Return encryption public key of an address
  route.post(
    '/_getEncryptionKey',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        address: Joi.string().required().custom(validateAddress),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'read')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /encryption_key/_getEncryptionKey endpoint with body: %o', req.body)
      try {
        const encryptionKeyInstance = Container.get(EncryptionKeyService)
        const { success, encryption_key } = await encryptionKeyInstance.getEncryptionKey(
          req.body.address.toLowerCase()
        )

        return res.status(201).json({ success, encryption_key })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
