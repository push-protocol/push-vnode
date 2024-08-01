import { errors } from 'celebrate'
import { celebrate, Joi } from 'celebrate'
import { Router } from 'express'
import { Container } from 'typedi'

import { ChatStatus, GroupType } from '../../../interfaces/chat'
import ChatService from '../../../services/chatService'

const route = Router()
export default (app: Router) => {
  app.use(`/v2/chat`, route)
  app.use(errors())

  const chatService = Container.get(ChatService)

  /**
   * GET GROUP INFO
   */
  route.get('/groups/:chatId', chatService.getGroupInfo)

  /**
   * CREATE GROUP ( V2 )
   * @dev - Every Param should be required rather than having default values since they are part of verification proof and needs to be signed by client and validated by Push Nodes
   */
  route.post(
    '/groups',
    celebrate({
      body: Joi.object({
        /******************* PROFILE VERIFICATION PROOF PARAMS ********************/
        groupName: Joi.string().min(3).max(100).allow(null).required(),
        groupDescription: Joi.string().min(3).max(150).allow(null).required(),
        groupImage: Joi.string().default(null).required(),
        isPublic: Joi.bool().required(),
        rules: Joi.object().required(),
        groupType: Joi.string()
          .valid(...Object.values(GroupType))
          .required(),
        profileVerificationProof: Joi.string().required(),
        /******************** CONFIG VERIFICATION PROOF PARAMS ********************/
        config: Joi.object({
          meta: Joi.string().allow(null).required(),
          scheduleAt: Joi.date().allow(null).required(),
          scheduleEnd: Joi.date().allow(null).required(),
          status: Joi.string()
            .valid(...Object.values(ChatStatus))
            .allow(null)
            .required(),
          configVerificationProof: Joi.string().required()
        }).required(),
        /****************** IDEMPOTENT VERIFICATION PROOF PARAMS *******************/
        members: Joi.array().items(Joi.string()).required(),
        admins: Joi.array().items(Joi.string()).required(),
        idempotentVerificationProof: Joi.string().required()
      })
    }),
    chatService.createGroupV2
  )
}
