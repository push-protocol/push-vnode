import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../../config'
import { convertCaipToAddress, convertCaipToObject } from '../../../helpers/caipHelper'
import EncryptionKeyService from '../../../services/encryptionKeyService'
import { deprecationNotice } from '../../middlewares/deprecationNotice'
import encryptionKeysInternal from '../internal/encryptionKeys.internal'
const route = Router()

export default (app: Router) => {
  // load internal routes
  encryptionKeysInternal(app)

  // Load the actual external routes
  app.use(`/${config.api.version}/encryption_keys`, route)
  app.use(errors())

  //return encryption keys of a wallet
  route.get(
    '/:walletAddressinCAIP/',
    deprecationNotice('2024-01-01'),
    celebrate({
      params: Joi.object({
        walletAddressinCAIP: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const { result: wallet, err } = convertCaipToAddress(req.params.walletAddressinCAIP)
        if (wallet && !err) {
          const encryptionKeyInstance = Container.get(EncryptionKeyService)
          const response = await encryptionKeyInstance.getKeys('eip155:' + wallet)
          return res.status(201).json(response)
        } else {
          return res.status(403).json('Error in verifying the wallet Address!')
        }
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  //registers encryption key of a wallet
  route.post(
    '/',
    celebrate({
      body: Joi.object({
        wallet: Joi.string().required(),
        publicKey: Joi.string().required(),
        encryptedPrivateKey: Joi.string().required(),
        encryptionType: Joi.string().required(),
        verificationProof: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      Logger.debug('Calling /v1/encryption_keys/ endpoint with body: %o', req.body)

      try {
        const {
          result: { chainId, address }
        } = convertCaipToObject(req.body.wallet)
        if (address && chainId) {
          const encryptionKeyInstance = Container.get(EncryptionKeyService)
          const response = await encryptionKeyInstance.registerKeys(
            'eip155:' + address,
            req.body.publicKey,
            req.body.encryptedPrivateKey,
            req.body.encryptionType,
            req.body.verificationProof,
            chainId
          )
          return res.status(201).json(response)
        } else {
          return res.status(403).json('Error in verifying the wallet Address!')
        }
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
