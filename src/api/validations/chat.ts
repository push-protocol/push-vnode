import { Joi } from 'celebrate'

import { MessageDTO } from '../../interfaces/chat'

export const postChatRequest = Joi.object<MessageDTO>({
  toDID: Joi.string().required(),
  fromDID: Joi.string().required(),
  fromCAIP10: Joi.string().required(),
  toCAIP10: Joi.string().required(),
  // Can be an object or encrypted string
  messageObj: Joi.alternatives().try(Joi.object(), Joi.string()),
  messageContent: Joi.string().allow(''),
  messageType: Joi.string().allow(''),
  // If we are sending an intent to a user that is not in our database, the intent will be in plaintext
  signature: Joi.string().allow(''),
  encType: Joi.string().required(),
  // If we are sending an intent to a user that is not in our database, the intent will be in plaintext
  encryptedSecret: Joi.string().allow(''),
  sigType: Joi.string().allow(''),
  verificationProof: Joi.string().default(null),
  sessionKey: Joi.string().default(null).allow(null)
})

export const postChatMessage = Joi.object<MessageDTO>({
  toDID: Joi.string().required(),
  messageType: Joi.string().required(),
  // Can be an object or encrypted string
  messageObj: Joi.alternatives().try(Joi.object(), Joi.string()),
  messageContent: Joi.string().required(),
  fromDID: Joi.string().required(),
  fromCAIP10: Joi.string().required(),
  toCAIP10: Joi.string().required(),
  signature: Joi.string().required().allow(''),
  encType: Joi.string().required().allow(''),
  encryptedSecret: Joi.string().required().allow('').allow(null),
  sigType: Joi.string().required().allow(''),
  verificationProof: Joi.string().default(null),
  sessionKey: Joi.string().default(null).allow(null)
})

export const putUpdateIntent = Joi.object({
  toDID: Joi.string().required(),
  fromDID: Joi.string().required(),
  signature: Joi.string().required(),
  status: Joi.string().required(),
  sigType: Joi.string().required(),
  verificationProof: Joi.string().default(null),
  encryptedSecret: Joi.string().allow(null).default(null)
})

export const putRejectIntent = Joi.object({
  toDID: Joi.string().required(),
  fromDID: Joi.string().required(),
  verificationProof: Joi.string().required()
})
