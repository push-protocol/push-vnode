import { Router } from 'express'
import { Container } from 'typedi'

const route = Router()

import { celebrate, errors, Joi } from 'celebrate'

import { UserCreate } from '../../../interfaces/chat'
import ChatService from '../../../services/chatService'

export default (app: Router) => {
  app.use(`/v2/users`, route)
  app.use(errors())

  const chatService = Container.get(ChatService)
  route.get('/', chatService.getUserV2)
  route.post('/batch', chatService.getUsersV2)

  route.post(
    '/',
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
        nftOwner: Joi.string().default(null).allow(null),
        origin: Joi.string().default(null).allow(null)
      })
    }),
    chatService.createUserV2
  )

  route.put(
    ['/users/:did', '/:did/auth'],
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
    chatService.updateUserV2
  )

  route.put(
    '/:did/profile',
    celebrate({
      body: Joi.object({
        picture: Joi.string().required(),
        desc: Joi.string().required().allow(null),
        name: Joi.string().required().allow(null),
        verificationProof: Joi.string().required(),
        blockedUsersList: Joi.array().items(Joi.string()).optional().allow(null).default(null)
      })
    }),
    chatService.updateUserProfile
  )
}
