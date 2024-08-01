import { celebrate, Joi } from 'celebrate'
import { Router } from 'express'
import { createValidator } from 'express-joi-validation'
import { Container } from 'typedi'

import config from '../../../config'
import ChatService from '../../../services/chatService'
import { createIntent, createMessage, updateIntent } from '../../controllers'
import { deprecationNotice } from '../../middlewares/deprecationNotice'
import { postChatMessage, postChatRequest, putUpdateIntent } from '../../validations'
import w2wInternal from '../internal/w2w.internal'

const route = Router()
export default (app: Router) => {
  const validator = createValidator()

  // load internal routes
  w2wInternal(app)

  app.use(`/${config.api.version}/w2w`, route)
  const chatService = Container.get(ChatService)

  route.get('/users/:did/messages', deprecationNotice('2024-01-01'), chatService.getInbox)

  route.get('/users/:did/requests', deprecationNotice('2024-01-01'), chatService.getRequests)

  route.get('/users/:did/chats', deprecationNotice('2024-01-01'), chatService.getChats)

  route.get('/users/:fromuser/conversations/:conversationid/hash', chatService.getSingleThread)

  route.get('/users', deprecationNotice('2024-01-01'), chatService.getUserV1)
  route.get(
    '/conversationhash/:threadhash',
    deprecationNotice('2024-01-01'),
    celebrate({
      query: Joi.object({
        fetchLimit: Joi.number().default(10).min(1).max(30)
      })
    }),
    chatService.getMessages
  )
  route.post(
    '/users',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        caip10: Joi.string().required(),
        did: Joi.string().required(),
        publicKey: Joi.string().allow(''),
        encryptedPrivateKey: Joi.string().allow(''),
        encryptionType: Joi.string().allow(''),
        signature: Joi.string().allow(''),
        sigType: Joi.string().allow(''),
        name: Joi.string().default('').allow('')
      })
    }),
    chatService.createUser
  )

  route.post(
    '/intents',
    deprecationNotice('2024-01-01'),
    validator.body(postChatRequest),
    createIntent
  )

  route.post(
    '/messages',
    deprecationNotice('2024-01-01'),
    validator.body(postChatMessage),
    createMessage
  )

  route.put(
    '/intents',
    deprecationNotice('2024-01-01'),
    validator.body(putUpdateIntent),
    updateIntent
  )

  route.put(
    '/users/:did',
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
        nftOwner: Joi.string().default(null).allow(null),
        verificationProof: Joi.string().default(null)
      })
    }),
    chatService.updateUser
  )

  route.post(
    '/waitlist',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        email: Joi.string()
      })
    }),
    chatService.addToSpaceWaitlist
  )
}
