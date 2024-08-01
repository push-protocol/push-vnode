import { celebrate, errors, Joi } from 'celebrate'
import { Router } from 'express'
import { Container } from 'typedi'

import { UserCreate } from '../../../interfaces/chat'
import ChatService from '../../../services/chatService'
import { deprecationNotice } from '../../middlewares/deprecationNotice'

const route = Router()

export default (app: Router) => {
  app.use(route)
  app.use(errors())

  // This API is deprecated on May-7 2023
  const chatService = Container.get(ChatService)
  route.get('/v1/users/', chatService.getUserV1)
  route.post('/v1/users/batch', chatService.getUsersV1)

  route.post(
    '/v1/users/',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object<UserCreate>({
        caip10: Joi.string().required(),
        did: Joi.string().required(),
        publicKey: Joi.string().allow(''),
        encryptedPrivateKey: Joi.string().allow(''),
        encryptionType: Joi.string().default('').allow(''),
        encryptedPassword: Joi.string().default(null).allow(null),
        name: Joi.string().default('').allow(''),
        // eip712v2 signature
        signature: Joi.string().default(null).allow(null),
        // eip712v2
        sigType: Joi.string().default(null).allow(null),
        verificationProof: Joi.string().default(null),
        nftOwner: Joi.string().default(null).allow(null)
      })
    }),
    chatService.createUser
  )

  route.put(
    ['/v1/users/users/:did', '/v1/users/:did/auth'],
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        caip10: Joi.string().allow(''),
        profilePictureCID: Joi.string().allow(''),
        name: Joi.string().allow(''),
        publicKey: Joi.string().default(null),
        encryptedPrivateKey: Joi.string().default(null),
        encryptionType: Joi.string().default(null),
        encryptedPassword: Joi.string().default(null).allow(null),
        verificationProof: Joi.string().default(null),
        nftOwner: Joi.string().default(null).allow(null)
      })
    }),
    chatService.updateUser
  )
}
