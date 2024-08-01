import { celebrate, Joi } from 'celebrate'
import { Router } from 'express'
import { createValidator } from 'express-joi-validation'
import { Container } from 'typedi'

import config from '../../../config'
import { ChatStatus, GroupChat, GroupType, UpdateGroup } from '../../../interfaces/chat'
import ChatService from '../../../services/chatService'
import { createIntent, createMessage, rejectIntent, updateIntent } from '../../controllers'
import {
  postChatMessage,
  postChatRequest,
  putRejectIntent,
  putUpdateIntent
} from '../../validations'
import chatInternal from '../internal/chat.internal'

const route = Router()
export default (app: Router) => {
  const validator = createValidator()

  //load internal routes
  chatInternal(app)

  app.use(`/${config.api.version}/chat`, route)
  const chatService = Container.get(ChatService)

  route.get('/users/:did/messages', chatService.getInbox)
  route.get('/:recipient/address/:current', chatService.getChatInfo)

  route.get(
    '/users/:did/requests',
    celebrate({
      query: Joi.object({
        page: Joi.number().default(1).min(1),
        limit: Joi.number().default(10).min(1).max(30)
      })
    }),
    chatService.getRequestsPagination
  )

  route.get(
    '/users/:did/chats',
    celebrate({
      query: Joi.object({
        page: Joi.number().default(1).min(1),
        limit: Joi.number().default(10).min(1).max(30)
      })
    }),
    chatService.getChatsPagination
  )

  route.get('/users/:fromuser/conversations/:conversationid/hash', chatService.getSingleThread)

  route.get(
    '/conversationhash/:threadhash',
    celebrate({ query: Joi.object({ fetchLimit: Joi.number().default(10).min(1).max(30) }) }),
    chatService.getMessages
  )

  route.post('/request', validator.body(postChatRequest), createIntent)

  route.post('/message', validator.body(postChatMessage), createMessage)

  route.put('/request/accept', validator.body(putUpdateIntent), updateIntent)
  route.put('/request/reject', validator.body(putRejectIntent), rejectIntent)

  // Group
  route.post(
    '/groups',
    celebrate({
      body: Joi.object<GroupChat>({
        groupName: Joi.string().min(3).max(100).required(),
        groupDescription: Joi.string().min(3).max(150).allow(null).default(null),
        members: Joi.array().items(Joi.string()).required(),
        groupImage: Joi.string().allow(null).default(null),
        admins: Joi.array().items(Joi.string()).required(),
        isPublic: Joi.bool().required(),
        contractAddressNFT: Joi.string().allow(null).default(null),
        numberOfNFTs: Joi.number().min(0).max(10_000).default(0),
        contractAddressERC20: Joi.string().allow(null).default(null),
        numberOfERC20: Joi.number().min(0).max(500e18).default(0),
        groupCreator: Joi.string().required(),
        verificationProof: Joi.string().required(),
        meta: Joi.string().default(null),
        scheduleAt: Joi.date().allow(null).default(null),
        scheduleEnd: Joi.date().allow(null).default(null),
        groupType: Joi.string()
          .valid(...Object.values(GroupType))
          .default(GroupType.DEFAULT),
        rules: Joi.object().optional().allow(null).default(null)
      })
    }),
    chatService.createGroup
  )

  route.get('/groups/:chatId', chatService.getGroupByChatId)
  route.get('/groups', chatService.getGroup)

  /**
   * This route is for getting chats by chatId or by the recipient wallet address
   */
  route.get('/users/:did/chat/:recipient', chatService.getChat)

  route.get('/groups/:chatId/access/:did', chatService.getGroupAccess)
  route.get('/groups/:chatId/members/:did/status', chatService.getGroupMemberStatus)

  route.put(
    '/groups/:chatId',
    celebrate({
      body: Joi.object<UpdateGroup>({
        groupName: Joi.string().min(3).max(100).default(null),
        groupDescription: Joi.string().min(3).max(150).allow(null).default(null),
        groupImage: Joi.string().allow(null).default(null),
        members: Joi.array().items(Joi.string()).default(null),
        admins: Joi.array().items(Joi.string()).default(null),
        address: Joi.string().required(),
        verificationProof: Joi.string().required(),
        meta: Joi.string().allow(null),
        scheduleAt: Joi.date().allow(null).default(null),
        scheduleEnd: Joi.date().allow(null).default(null),
        status: Joi.string()
          .valid(...Object.values(ChatStatus), null)
          .default(null),
        encryptedSecret: Joi.string().allow(null).default(null),
        rules: Joi.object().optional().allow(null).default(null)
      })
    }),
    chatService.updateGroup
  )

  /**
   * SEARCH GROUPS
   */
  route.post(
    '/groups/search',
    celebrate({
      body: Joi.object({
        searchTerm: Joi.string().required(),
        pageNumber: Joi.number().integer().min(1).required(),
        pageSize: Joi.number().integer().min(1).required()
      })
    }), // Validate the request body
    async (req, res) => {
      const { searchTerm, pageNumber, pageSize } = req.body
      try {
        const processedGroups = await chatService.searchGroups({
          searchTerm,
          pageNumber,
          pageSize
        })
        res.json(processedGroups)
      } catch (error) {
        // Handle errors appropriately
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  /**
   * GET ENCRYPTED SECRET FOR THE GIVEN SESSION KEY
   */
  route.get('/encryptedsecret/sessionKey/:sessionKey', chatService.getSecretKey)

  /**
   * GET GROUP PARTICIPANTS
   */
  route.get(
    '/groups/:chatId/members',
    celebrate({
      params: Joi.object().keys({
        chatId: Joi.string().required()
      }),
      query: Joi.object().keys({
        pageNumber: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(5000).default(50),
        pending: Joi.boolean().optional(),
        role: Joi.string().valid('admin', 'member').optional()
      })
    }),
    chatService.getGroupMembers
  )

  /**
   * GET GROUP PARTICIPANTS
   */
  route.get(
    '/groups/:chatId/members/publicKeys',
    celebrate({
      params: Joi.object().keys({
        chatId: Joi.string().required()
      }),
      query: Joi.object().keys({
        pageNumber: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(5000).default(50)
      })
    }),
    chatService.getGroupMembersPublicKeys
  )

  /**
   * GET GROUP PARTICIPANTS COUNT
   */
  route.get(
    '/groups/:chatId/members/count',
    celebrate({
      params: Joi.object({
        chatId: Joi.string().required()
      })
    }),
    chatService.getGroupMemberCount
  )

  /**
   * UPDATE GROUP PROFILE
   */
  route.put(
    '/groups/:chatId/profile',
    celebrate({
      body: Joi.object({
        groupName: Joi.string().min(3).max(100).allow(null).required(),
        groupDescription: Joi.string().min(3).max(150).allow(null).required(),
        groupImage: Joi.string().allow(null).default(null).required(),
        rules: Joi.object().required(),
        profileVerificationProof: Joi.string().required()
      }),
      params: Joi.object({
        chatId: Joi.string().required()
      })
    }),
    chatService.updateGroupProfile
  )

  /**
   * UPDATE GROUP CONFIG
   */
  route.put(
    '/groups/:chatId/config',
    celebrate({
      body: Joi.object({
        meta: Joi.string().allow(null).required(),
        scheduleAt: Joi.date().allow(null).required(),
        scheduleEnd: Joi.date().allow(null).required(),
        status: Joi.string()
          .valid(...Object.values(ChatStatus))
          .allow(null)
          .required(),
        configVerificationProof: Joi.string().required()
      }),
      params: Joi.object({
        chatId: Joi.string().required()
      })
    }),
    chatService.updateGroupConfig
  )

  /**
   * UPDATE GROUP PARTICIPANTS
   */
  route.put(
    '/groups/:chatId/members',
    celebrate({
      body: Joi.object({
        // Infuture if we move towards custom roles, admins and members hardcoding can be removed and dynamic keys can be added.
        upsert: Joi.object({
          admins: Joi.array().items(Joi.string()).max(1000),
          members: Joi.array().items(Joi.string()).max(1000)
        }).required(),
        remove: Joi.array().items(Joi.string()).max(1000).required(),
        encryptedSecret: Joi.string().required().allow(null),
        deltaVerificationProof: Joi.string().required()
      }),
      params: Joi.object({
        chatId: Joi.string().required()
      })
    }),
    chatService.updateGroupMembers
  )
}
