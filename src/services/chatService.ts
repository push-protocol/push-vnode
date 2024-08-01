import { verifyMessage } from '@ambire/signature-validator'
import { Joi } from 'celebrate'
import CryptoJs from 'crypto-js'
import { ethers } from 'ethers'
import { NextFunction, Request, Response } from 'express'
import { CID } from 'ipfs-http-client'
import _ from 'lodash'
import os from 'os'
import path from 'path'
import { Service } from 'typedi'
import { Container } from 'typedi'
import { Logger } from 'winston'

import { Result } from '../api/sockets/chatEvents'
import { PushSocket, REDIS_KEY_PREFIX_DID } from '../api/sockets/pushsocket'
import config from '../config'
import * as w2wRepository from '../db-access/w2w'
import {
  fetchParticipants,
  getMessageByReference,
  getReferenceFromThreadhash
} from '../db-access/w2w'
import { SortOrderOptions, SpacesSortByOptions } from '../enums/chat'
import { HttpStatus } from '../errors/apiConstants'
import { CommonErrors } from '../errors/commonErrors'
import { ErrorHandler } from '../errors/errorHandler'
import { ValidationError } from '../errors/validationError'
import {
  arraysEqual,
  checkAccessRulesForNewMembers,
  checkBlockStatus,
  combinedWalletDID,
  createRandomNameAndProfile,
  evaluateRules,
  getNFTOwner,
  getSizeInBytes,
  isAutoJoin,
  isAutoLeave,
  isValidCAIP10Address,
  isValidNFTAddress,
  isValidNFTAddressV2,
  isValidSCWAddress,
  numberOfERC20Tokens,
  numberOfNFTTokens,
  validateAddressFormats,
  validateCommonElements,
  validateMemberRemoval,
  validateRules,
  verifyGitcoinDonner,
  verifySignature
} from '../helpers/chatHelper'
import * as cryptoHelper from '../helpers/cryptoHelper'
import { deleteJsonFile, writeJsonToFile } from '../helpers/fileStorageHelper'
import * as payloadVerificationHelper from '../helpers/payloadVerificationHelper'
import { checkFileSize } from '../helpers/utilsHelper'
import { isValidActualCAIP10Address } from '../helpers/utilsHelper'
import {
  Chat,
  ChatInbox,
  ChatMemberCounts,
  ChatMemberProfile,
  ChatMemberPublicKey,
  ChatStatus,
  CreateGroupV2,
  EncryptionKeys,
  GroupChat,
  GroupConfig,
  GroupDelta,
  GroupDTO,
  GroupEventType,
  GroupIdempotent,
  GroupInfoDTO,
  GroupProfile,
  GroupType,
  Inbox,
  IntentStatus,
  Message,
  MessageCategory,
  MessageDTO,
  RejectIntent,
  RequestInbox,
  SpaceDTO,
  SpaceEventType,
  SpaceInbox,
  UpdateGroup,
  UpdateIntent,
  User,
  UserV2
} from '../interfaces/chat'
import { client as redisClient } from '../loaders/redis'
import PayloadsService from './payloadsService'

const MAX_MESSAGES_W2W = 1000
const MAX_GROUPS_CAN_CREATE = 1000
const MAX_SPACES_CAN_CREATE = 1000
const MAX_SIZE_BYTES_PER_MESSAGE = 1 * 1024 * 1024
const SIG_TYPE_V2 = 'eip712v2'
const SIG_TYPE_V3 = 'eip191'
const SIG_TYPE_V4 = 'eip191v2'
const PROFILE_SIG_TYPE_V1 = 'pgp'
const PROFILE_SIG_TYPE_V2 = 'pgpv2'
const MAX_GROUP_MEMBERS_PUBLIC = 100000
const NEW_MAX_GROUP_MEMBERS_PRIVATE = 15000
const ENC_TYPE_V0 = ''
const ENC_TYPE_V1 = 'x25519-xsalsa20-poly1305'
const ENC_TYPE_V2 = 'aes256GcmHkdfSha256'
const ENC_TYPE_V3 = 'eip191-aes256-gcm-hkdf-sha256'
const ENC_TYPE_V4 = 'pgpv1:nft'
const ENC_TYPE_V5 = 'pgpv1:scw'

// Events at what Push Notifications are sent
enum PUSH_CHAT_NOTIFICATION {
  /**
   * CHAT EVENTS
   */
  CREATE_MESSAGE = 'CREATE_MESSAGE',
  CREATE_INTENT = 'CREATE_INTENT',
  CREATE_GROUP = 'CREATE_GROUP',
  UPDATE_GROUP = 'UPDATE_GROUP',
  /**
   * SPACE EVENTS
   */
  CREATE_SPACE = 'CREATE_SPACE',
  UPDATE_SPACE = 'UPDATE_SPACE',
  START_SPACE = 'START_SPACE',
  END_SPACE = 'END_SPACE',
  UPCOMING_SPACE = 'UPCOMING_SPACE'
}

const PRIVATE_KEY_SCHEMA_V1 = Joi.object({
  version: Joi.string().required(),
  nonce: Joi.string().required(),
  ephemPublicKey: Joi.string().required(),
  ciphertext: Joi.string().required()
})
const PRIVATE_KEY_SCHEMA_V2 = Joi.object({
  version: Joi.string().required(),
  nonce: Joi.string().required(),
  salt: Joi.string().required(),
  preKey: Joi.string().required().allow(''),
  ciphertext: Joi.string().required()
})
const PUBLIC_KEY_SCHEMA_V2 = Joi.object({
  key: Joi.string().required(),
  signature: Joi.string().required()
})
const PRIVATE_KEY_SCHEMA_V3 = PRIVATE_KEY_SCHEMA_V2
const PUBLIC_KEY_SCHEMA_V3 = PUBLIC_KEY_SCHEMA_V2

const PRIVATE_KEY_SCHEMA_V4 = Joi.object({
  version: Joi.string().required(),
  nonce: Joi.string().required(),
  salt: Joi.string().required(),
  preKey: Joi.string().required().allow(''),
  ciphertext: Joi.string().required(),
  encryptedPassword: Joi.object()
    .required()
    .keys({
      version: Joi.string().required(),
      nonce: Joi.string().required(),
      salt: Joi.string().required(),
      ciphertext: Joi.string().required(),
      preKey: Joi.string().required().allow('')
    })
})
const PUBLIC_KEY_SCHEMA_V4 = PUBLIC_KEY_SCHEMA_V3

const PRIVATE_KEY_SCHEMA_V5 = Joi.object({
  version: Joi.string().required(),
  nonce: Joi.string().required(),
  salt: Joi.string().required(),
  ciphertext: Joi.string().required(),
  shardInfo: Joi.object()
    .required()
    .keys({
      pattern: Joi.string().required(),
      shards: Joi.array()
        .items(
          Joi.object().required().keys({
            shard: Joi.any().required(),
            encryptionType: Joi.string().required()
          })
        )
        .required()
    })
})
const PUBLIC_KEY_SCHEMA_V5 = Joi.string().required()

type UPDATE_USER_SIGNATURE_KEYS =
  | 'caip10'
  | 'did'
  | 'publicKey'
  | 'encryptedPrivateKey'
  | 'encryptionType'
  | 'signature'
  | 'sigType'
  | 'encryptedPassword'
  | 'nftOwner'

enum ENCRYPTION_VERSIONS_FOR_APPROVE_INTENT {
  pgpv1 = 'pgp', // Supported for W2W and Groups
  pgpv2 = 'pgpv2' // Supported for Private Groups with sessionKey
}

const FILE_STORAGE_DIR: string = path.join(os.homedir(), 'chats')

@Service()
export default class ChatService {
  constructor() {
    this.createUser = this.createUser.bind(this)
    this.updateUser = this.updateUser.bind(this)
    this.createGroup = this.createGroup.bind(this)
    this.updateGroup = this.updateGroup.bind(this)
    this.createGroupV2 = this.createGroupV2.bind(this)
    this.updateGroupProfile = this.updateGroupProfile.bind(this)
    this.updateGroupConfig = this.updateGroupConfig.bind(this)
    this.batchRemoveExpiredGroups = this.batchRemoveExpiredGroups.bind(this)
  }

  /**
   * @deprecated - Does not support pagination, use @getChatsPagination instead
   */
  public async getInbox(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const did = req.params.did
      const inbox: Inbox[] = await w2wRepository.getInbox(did)
      return res.status(200).json(inbox)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * @deprecated - Does not support pagination, use @getChatsPagination instead
   */
  public async getChats(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const did = req.params.did
      const chats: Inbox[] = await w2wRepository.getChats(did)
      return res.status(200).json({ chats: chats })
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * @deprecated - Does not support pagination, use @getRequestsPagination instead
   */
  public async getRequests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const did = req.params.did
      const requests: Inbox[] = await w2wRepository.getRequests(did)
      return res.status(200).json({ requests: requests })
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getChatsPagination(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const did = req.params.did
      const chats: Inbox[] = await w2wRepository.getChatsPaginationV2(
        did,
        // @ts-ignore
        req.query.page,
        req.query.limit
      )
      const chatInbox: ChatInbox[] = []
      for (const chat of chats) {
        let message: Message
        if (chat.threadhash !== null) {
          const reference = await getReferenceFromThreadhash(chat.threadhash)
          message = await getMessageByReference(reference)
        }
        // This is for groups that are created without any message
        else {
          message = {
            encType: 'PlainText',
            encryptedSecret: '',
            fromCAIP10: '',
            fromDID: '',
            link: '',
            messageContent: '',
            messageType: '',
            sigType: '',
            signature: '',
            toCAIP10: '',
            toDID: ''
          }
        }
        chatInbox.push({
          ...chat,
          msg: message
        })
      }
      return res.status(200).json({ chats: chatInbox })
    } catch (e) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', e)
      if (e instanceof ValidationError) {
        const errorResponse = {
          status: e.status,
          errorCode: e.errorCode,
          message: e.message,
          details: e.details,
          timestamp: new Date().toISOString()
        }
        return res.status(e.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(e.message))
    }
  }

  public async getRequestsPagination(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const did = req.params.did
      const requests: Inbox[] = await w2wRepository.getRequestsPaginationV2(
        did,
        // @ts-ignore
        req.query.page,
        req.query.limit
      )
      const RequestInbox: RequestInbox[] = []
      for (const request of requests) {
        let message: Message
        if (request.threadhash !== null) {
          const reference = await getReferenceFromThreadhash(request.threadhash)
          message = await getMessageByReference(reference)
        }
        // This is for groups that are created without any message
        else {
          message = {
            encType: 'PlainText',
            encryptedSecret: '',
            fromCAIP10: '',
            fromDID: '',
            link: '',
            messageContent: '',
            messageType: '',
            sigType: '',
            signature: '',
            toCAIP10: '',
            toDID: ''
          }
        }
        RequestInbox.push({
          ...request,
          msg: message
        })
      }

      return res.status(200).json({ requests: RequestInbox })
    } catch (e) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', e)
      if (e instanceof ValidationError) {
        const errorResponse = {
          status: e.status,
          errorCode: e.errorCode,
          message: e.message,
          details: e.details,
          timestamp: new Date().toISOString()
        }
        return res.status(e.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(e.message))
    }
  }

  public async getSpacesRequestsPagination(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const did = req.params.did
      const page = isNaN(parseInt(req.query.page as string))
        ? 1
        : parseInt(req.query.page as string)
      const limit = isNaN(parseInt(req.query.limit as string))
        ? 10
        : parseInt(req.query.limit as string)
      const requests: SpaceInbox[] = await w2wRepository.getSpacesRequestsPaginationV2(
        did,
        page,
        limit
      )
      return res.status(200).json({ requests: requests })
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getSpacesPagination(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const did = req.params.did
      const page = isNaN(parseInt(req.query.page as string))
        ? 1
        : parseInt(req.query.page as string)
      const limit = isNaN(parseInt(req.query.limit as string))
        ? 10
        : parseInt(req.query.limit as string)
      const spaces: SpaceInbox[] = await w2wRepository.getSpacesPaginationV2(did, page, limit)
      return res.status(200).json({ spaces: spaces })
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getTrendingSpacesPagination(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const page = isNaN(parseInt(req.query.page as string))
        ? 1
        : parseInt(req.query.page as string)
      const limit = isNaN(parseInt(req.query.limit as string))
        ? 10
        : parseInt(req.query.limit as string)
      const spaces: SpaceInbox[] = await w2wRepository.getTrendingSpacesPagination(page, limit)
      return res.status(200).json({ spaces: spaces })
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async searchGroups({
    searchTerm,
    pageNumber,
    pageSize
  }: {
    searchTerm: string
    pageNumber: number
    pageSize: number
  }): Promise<GroupDTO[]> {
    const chats: Chat[] = await w2wRepository.searchGroupsByText({
      searchTerm,
      pageNumber,
      pageSize
    })

    const processedGroups: GroupDTO[] = []

    for (const chat of chats) {
      const groupDTO: GroupDTO | null = await getGroupDTO(chat.chatId)
      if (groupDTO) {
        processedGroups.push(groupDTO)
      }
    }
    return processedGroups
  }

  public async searchSpaces({
    searchTerm,
    pageNumber,
    pageSize
  }: {
    searchTerm: string
    pageNumber: number
    pageSize: number
  }): Promise<SpaceDTO[]> {
    const chats: Chat[] = await w2wRepository.searchSpacesByText({
      searchTerm,
      pageNumber,
      pageSize
    })

    const processedSpaces: SpaceDTO[] = []

    for (const chat of chats) {
      const groupDTO: GroupDTO | null = await getGroupDTO(chat.chatId)
      if (groupDTO) {
        processedSpaces.push(convertGroupToSpace(groupDTO))
      }
    }

    return processedSpaces
  }

  public async getSingleThread(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const fromUser = req.params.fromuser
      const toUser = req.params.conversationid
      if (!isValidCAIP10Address(fromUser)) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAddress,
          'Invalid address',
          'The provided address is invalid.'
        )
      }
      const isGroup = !isValidCAIP10Address(toUser)

      const threadHash: { threadHash: string } = await w2wRepository.getSingleThreadHash(
        fromUser,
        toUser,
        isGroup
      )

      return res.status(200).json(threadHash)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async createUserV2(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const result = await createUserHelper(req)
      if (result.success) {
        const did = req.body.did
        const response = await w2wRepository.getUserV2(did)
        return res.status(201).json(response)
      } else {
        // Consider using ValidationError if the error is due to input validation
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAPIInput, // Ensure this error code exists in CommonErrors
          'User creation failed',
          result.error
        )
      }
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * @deprecated - Use @createUserV2 instead
   */
  public async createUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const result = await createUserHelper(req)
      if (result.success) {
        return res.status(201).json(result.data)
      } else {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAPIInput,
          'User creation failed',
          result.error
        )
      }
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async updateUserV2(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const result = await updateUserHelper(req)
      if (result.success) {
        const did: string = req.params.did
        const response = await w2wRepository.getUserV2(did)
        return res.status(200).json(response)
      } else {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAPIInput,
          'User updation failed',
          result.error
        )
      }
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * @deprecated - Use @updateUserV2 instead
   */
  public async updateUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const result = await updateUserHelper(req)
      if (result.success) {
        return res.status(201).json(result.data)
      } else {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAPIInput,
          'User updation failed',
          result.error
        )
      }
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async updateUserProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      if (!req.body.verificationProof) {
        return res.status(400).json({
          success: false,
          error: 'No valid verificationProof'
        })
      }

      if (!req.body.verificationProof) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.MissingVerificationProof,
          'No valid verificationProof provided.',
          'No valid verificationProof provided.'
        )
      }
      const body = req.body
      const did: string = req.params.did as string
      let signature: string
      let sigType: string
      if (body.verificationProof.split(':').length == 2) {
        signature = body.verificationProof.split(':')[1]
        sigType = body.verificationProof.split(':')[0]
      }
      let user: UserV2 = await w2wRepository.getUserV2(did)
      if (!user) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.UserNotFound,
          'User not found.',
          `The user with DID '${did}' is not found.`
        )
      }

      if (!signature || !sigType) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.MissingVerificationProof,
          'No valid verificationProof provided.',
          'No valid verificationProof provided.'
        )
      }

      if (!checkFileSize(body.picture)) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidPictureDimensions,
          'Invalid picture dimensions.',
          'Invalid picture dimensions.'
        )
      }

      const blockedUsersList = req.body.blockedUsersList

      if (blockedUsersList) {
        const uniqueSet = new Set(blockedUsersList)
        if (uniqueSet.size < blockedUsersList.length) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.DuplicateBlockedUsers,
            'Duplicate addresses found in blockedUsersList.',
            'Duplicate addresses found in blockedUsersList.'
          )
        }
        for (const element of blockedUsersList) {
          // Check if the element is a valid CAIP-10 address
          if (!isValidCAIP10Address(element)) {
            throw new ValidationError(
              HttpStatus.BadRequest,
              CommonErrors.InvalidAddress,
              'Invalid address in the blockedUsersList.',
              `Invalid address '${element}' found in the blockedUsersList.`
            )
          }
        }
      }

      if (sigType === PROFILE_SIG_TYPE_V1 || sigType === PROFILE_SIG_TYPE_V2) {
        let updatedProfile

        if (sigType === PROFILE_SIG_TYPE_V1) {
          updatedProfile = {
            name: body.name,
            desc: body.desc,
            picture: body.picture
          }
        } else if (sigType === PROFILE_SIG_TYPE_V2) {
          updatedProfile = {
            name: body.name,
            desc: body.desc,
            picture: body.picture,
            blockedUsersList: body.blockedUsersList
          }
        }

        const hash = CryptoJs.SHA256(JSON.stringify(updatedProfile)).toString()

        if (
          !(await verifySignature({
            messageContent: hash,
            signatureArmored: signature,
            publicKeyArmored: JSON.parse(user.publicKey).key
          }))
        ) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.InvalidSigner,
            'Invalid signer',
            'The provided signature does not match the expected signer.'
          )
        }
      } else {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidSignatureFormat,
          'Invalid Signature Format',
          'The provided signature format is invalid. Expected PROFILE_SIG_TYPE_V1 or PROFILE_SIG_TYPE_V2.'
        )
      }

      const updateUserRequest = {
        did: did,
        profile: {
          name: body.name,
          desc: body.desc,
          picture: body.picture,
          blockedUsersList: body.blockedUsersList ? body.blockedUsersList : [],
          profileVerificationProof: body.verificationProof
        }
      }
      user = await w2wRepository.updateUserProfile(updateUserRequest)
      return res.status(201).json(user)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * @deprecated - Use @getUserV2 instead
   */
  public async getUserV1(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const user = await getUserCommon(req, res, false)
      if (user !== null) {
        user.nfts = []
      }
      return res.status(200).json(user)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getUserV2(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const user = await getUserCommon(req, res, true)
      return res.status(200).json(user)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * @deprecated - Use @getUsersV2 instead
   */
  public async getUsersV1(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const response = await getUsersCommon(req, res, false)
      return res.status(200).json(response)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getUsersV2(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const response = await getUsersCommon(req, res, true)
      return res.status(200).json(response)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * CREATE MESSAGE REFERENCE
   * @param message message for which the reference is to be created
   * @returns message reference - unique identifier for the message
   */
  public createMessageReference(message: MessageDTO): string {
    const referencedPayload = {
      fromDID: message.fromDID,
      toDID: message.fromDID,
      fromCAIP10: message.fromCAIP10,
      toCAIP10: message.toCAIP10,
      messageObj: message.messageObj,
      messageType: message.messageType,
      encType: message.encType,
      sessionKey: message.sessionKey,
      encryptedSecret: message.encryptedSecret,
      timestamp: message.timestamp
    }
    return `v2:${CryptoJs.SHA256(JSON.stringify(referencedPayload)).toString()}`
  }

  /**
   * VERIFY MESSAGE VERIFICATION PROOF
   * @param message message to be verified
   */
  private async verifyMessageVerificationProof(message: MessageDTO): Promise<void> {
    if (message.verificationProof.split(':').length !== 2) {
      throw new Error('Verification proof must be in the format sigType:signature')
    }
    const encryptionKeys = await w2wRepository.getPublicKeyEncryptedPrivateKey(message.fromDID)
    if (!encryptionKeys) {
      throw new Error('Message Sender does not have a Push Profile')
    }

    const MESSAGE_SIGTYPE: string[] = ['pgp', 'pgpv2', 'pgpv3']
    const sigType: string = message.verificationProof.split(':')[0]
    let signature: string = message.verificationProof.split(':')[1]
    let signedContent: string
    switch (sigType) {
      case MESSAGE_SIGTYPE[0]: {
        // initially only messageContent was verified
        signature = message.signature
        signedContent = message.messageContent
        break
      }
      case MESSAGE_SIGTYPE[1]: {
        const bodyToBeHashed = {
          fromDID: message.fromDID,
          toDID: message.fromDID,
          fromCAIP10: message.fromCAIP10,
          toCAIP10: message.toCAIP10,
          messageObj: message.messageObj,
          messageType: message.messageType,
          encType: message.encType,
          encryptedSecret: message.encryptedSecret
        }
        signedContent = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
        break
      }
      case MESSAGE_SIGTYPE[2]: {
        const bodyToBeHashed = {
          fromDID: message.fromDID,
          toDID: message.fromDID,
          fromCAIP10: message.fromCAIP10,
          toCAIP10: message.toCAIP10,
          messageObj: message.messageObj,
          messageType: message.messageType,
          encType: message.encType,
          sessionKey: message.sessionKey,
          encryptedSecret: message.encryptedSecret
        }
        signedContent = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
        break
      }
      default: {
        throw new Error('Invalid Verification Proof SigType')
      }
    }

    try {
      const isSignatureValid: boolean = await verifySignature({
        messageContent: signedContent,
        signatureArmored: signature,
        publicKeyArmored: encryptionKeys.publicKeyArmored
      })
      if (!isSignatureValid) {
        throw new Error()
      }
    } catch (err) {
      // If signature is non-sense, for eg a random string, the library will throw an exception
      throw new Error('Invalid Verification Proof')
    }
  }

  /**
   * INSERT A CHAT MESSAGE
   * @param message
   * @param chatId chat_id to which the message belongs
   * @dev - DB - Primary Storage
   * @dev - File Storage - Secondary Storage ( Also will be used to compare performance between DB & File Storage )
   * @dev - IPFS - Tertiary Storage ( This might be removed in future )
   */
  public async insertMessage(
    reference: `v2:${string}`,
    message: Message,
    chatId: string
  ): Promise<void> {
    const cid: string = await w2wRepository.createCID(message)
    /**
     * ADD MESSAGE INTO DB
     */
    await w2wRepository.createMessage({
      reference,
      chatId,
      payload: JSON.stringify(message),
      timestamp: new Date(message.timestamp).toISOString().slice(0, 19).replace('T', ' '),
      cid
    })
    /**
     * ADD MESSAGE TO FILE STORAGE
     * @dev - Async Process
     */
    writeJsonToFile(message, reference, FILE_STORAGE_DIR)
    /**
     * UPLOAD MESSAGE TO IPFS & MARK MESSAGE AS UPLOADED
     * @dev - Async Process
     */
    w2wRepository
      .uploadMessageToIPFS(message)
      .then(() => {
        w2wRepository.markMessageAsUploaded(reference)
      })
      .catch((err) => {
        const logger: Logger = Container.get('logger')
        logger.error(`Error in Uploading Message with reference ${reference} To IPFS : %o`, err)
      })
  }

  /**
   * Removes all messages for a chatId
   * @param chatId chatId for which messages are to be removed
   * @dev - Messages are removed from DB, File Storage & IPFS
   * @dev - Only done for expired chats
   */
  public async removeMessagesForChatId(chatId: string): Promise<void> {
    const LIMIT = 1000
    let offset = 0
    let messagesData: { reference: string; cid: string }[]
    do {
      messagesData = await w2wRepository.getMessagesDataForChatID(chatId, LIMIT, offset)
      for (const messageData of messagesData) {
        // remove from file storage
        await deleteJsonFile(messageData.reference, FILE_STORAGE_DIR)
        // unpin from ipfs
        const cidObject: CID = CID.parse(messageData.cid)
        await w2wRepository.unpinMessages(cidObject)
      }
      offset += LIMIT
    } while (messagesData.length === LIMIT)
    await w2wRepository.deleteMessagesForChatID(chatId)
  }

  /**
   * Uploads and pins the message to IPFS
   * @dev - used as a CRON JOB
   */
  public async batchUploadMessagesToIPFS(): Promise<void> {
    const logger: Logger = Container.get('logger')
    logger.debug('Trying to call batchUploadMessagesToIPFS (5000 at a time)')
    const LIMIT = 5000
    const messages: Message[] = await w2wRepository.getMessagesNotUploadedToIPFS(LIMIT)
    for (const message of messages) {
      w2wRepository
        .uploadMessageToIPFS(message)
        .then(() => {
          w2wRepository.markMessageAsUploaded(message.reference as `v2:${string}`)
        })
        .then(() => {
          // If the message is not uploaded to IPFS, then there is a high chance that it is not in file storage as well
          writeJsonToFile(message, message.reference as string, FILE_STORAGE_DIR)
        })
        .catch((err) => {
          logger.error(
            `Error in Uploading Message with reference ${message.reference} To IPFS : %o`,
            err
          )
        })
    }
    logger.info('Completed batchUploadMessagesToIPFS()')
  }

  /**
   * CREATES A INTENT BETWEEN TWO USERS
   * @dev - This function is only used for 1 to 1 chat and not for groups / spaces
   * @dev - This marks the beginning of the chat which includes chat creation & sending message
   * @param intent intent message
   * @retuns created intent message by Push Node
   */
  public async createIntent(intent: MessageDTO): Promise<Result> {
    const logger: Logger = Container.get('logger')
    try {
      /**
       * PARAM VALIDATIONS
       */
      if (intent.fromDID === intent.toDID) {
        return { success: false, error: 'Both DIDs are the same' }
      }
      if (!isValidCAIP10Address(intent.fromCAIP10)) {
        return { success: false, error: 'Wrong wallet format' }
      }
      if (!isValidCAIP10Address(intent.toCAIP10) || !isValidCAIP10Address(intent.toDID)) {
        return { success: false, error: 'Group has no support for create intent' }
      }
      /**
       * VERIFICATION PROOF VALIDATIONS
       */
      try {
        await this.verifyMessageVerificationProof(intent)
      } catch (err) {
        return { success: false, error: err.message }
      }
      /**
       * SIZE VALIDATIONS
       */
      if (getSizeInBytes(intent) > MAX_SIZE_BYTES_PER_MESSAGE) {
        return { success: false, error: 'Message paylaod is over the maximum limit' }
      }
      /**
       * SENDER RECEIVER PROFILE VALIDATIONS
       */
      const userFrom: UserV2 = await w2wRepository.getUserV2(intent.fromDID)
      const userTo: UserV2 = await w2wRepository.getUserV2(intent.toDID)
      if (!userFrom || !userTo) {
        return { success: false, error: 'No user created' }
      }
      /**
       * BLOCK STATUS VALIDATIONS
       */
      const { success, error } = await checkBlockStatus(userFrom, userTo)
      if (!success) {
        return { success: false, error: error }
      }
      /**
       * DUPLICATE INTENT VALIDATIONS
       */
      const { combinedDID } = combinedWalletDID({
        firstDID: intent.toDID,
        secondDID: intent.fromDID
      })
      const hasIntent: boolean = await w2wRepository.hasIntent({ combinedDID: combinedDID })
      if (hasIntent) {
        return { success: false, error: 'Intent already exists' }
      }
      /**
       * META MESSAGE VALIDATIONS
       */
      if (intent.messageType === 'Meta' || intent.messageType === 'UserActivity') {
        return { success: false, error: 'Meta Messages are only allowed in Group Chat' }
      }
      /**
       * BUILD MESSAGE
       * @dev - This includes creation of `reference` which is a unique identifier for the message
       */
      const reference: string = this.createMessageReference(intent)
      const message: Message = {
        ...intent,
        link: null
      }
      /**
       * INSERT CHAT
       */
      const chat: Chat = {
        combinedDID: combinedDID,
        threadhash: reference,
        intent: intent.fromDID,
        intentSentBy: intent.fromDID,
        chatId: CryptoJs.SHA256(
          JSON.stringify({ combinedDID, reference, timestamp: Date.now() })
        ).toString(),
        groupType: GroupType.DEFAULT,
        status: null
      }
      await w2wRepository.insertNewChat(chat)
      await w2wRepository.populateChatMembersByChatId(chat.chatId)
      const createdMessage = { ...message, cid: reference, chatId: chat.chatId }
      /**
       * INSERT MESSAGE
       *
       */
      await this.insertMessage(reference as `v2:${string}`, message, chat.chatId)
      /**
       * UPDATE MESSAGES SENT COUNT BY 1
       */
      w2wRepository.updateMessagesSent(1, message.fromDID)
      /**
       * SEND PUSH NOTIFICATION TO RECEIVER
       * @dev - Asynchronously send push notification to receiver
       */
      this.sendNotification(
        PUSH_CHAT_NOTIFICATION.CREATE_INTENT,
        message.fromDID,
        chat.chatId,
        message.signature,
        message.messageContent
      )
      /**
       * SEND SOCKET EVENT TO RECEIVER
       * @dev - Asynchronously send socket event to receiver
       */
      sendIntentSocketEvent(false, false, combinedDID, createdMessage, MessageCategory.Request)
      /**
       * RETURN RESPONSE
       */
      return { success: true, data: createdMessage }
    } catch (e) {
      logger.error('Error: %o', e)
      return { success: false, error: 'server error' }
    }
  }

  /**
   * APPROVES AN INTENT BETWEEN TWO USERS / GROUPS / SPACES
   * @todo - Should be renamed to `approveIntent` instead
   * @dev - approve intent message is NOT inserted into the database, it is only used to update chat intent status and chat members as of now
   * @param intent intent approval message
   */
  public async updateIntent(intent: UpdateIntent): Promise<Result> {
    const logger: Logger = Container.get('logger')
    try {
      const status = intent.status
      /***************************** PARAM VALIDATION **********************************/
      if (intent.status !== IntentStatus.Approved) {
        return { success: false, error: 'Status is not valid' }
      }
      if (intent.fromDID === intent.toDID) {
        return { success: false, error: 'DID are the same' }
      }
      if (!isValidCAIP10Address(intent.fromDID))
        return { success: false, error: `Invalid address ${intent.fromDID}` }

      const isGroup: boolean = !isValidCAIP10Address(intent.toDID)
      const userFrom: UserV2 = await w2wRepository.getUserV2(intent.fromDID)
      const userTo: UserV2 = isGroup ? null : await w2wRepository.getUserV2(intent.toDID)
      if (!userFrom) return { success: false, error: 'No user created for `fromDID`' }
      if (!userTo && !isGroup) {
        return { success: false, error: 'No user created for `toDID`' }
      }

      let combinedDID: string
      let chat: Chat
      let groupAutoJoin = false
      const did = isGroup ? intent.fromDID : intent.toDID // TODO: Fix approve intent from group or w2w to always use the fromDID or the toDID instead of this condition below

      // W2W Specific validations ( Non Group )
      if (!isGroup) {
        const { combinedDID: combDID } = combinedWalletDID({
          firstDID: intent.toDID,
          secondDID: intent.fromDID
        })
        combinedDID = combDID
        chat = await w2wRepository.getChat({
          combinedDID: combinedDID,
          isGroup: isGroup,
          chatId: intent.toDID
        })
        if (!chat) return { success: false, error: 'There is no intent to approve' }

        const blockStatus = await checkBlockStatus(userFrom, userTo)
        if (!blockStatus.success) {
          logger.info(blockStatus.error)
          return blockStatus
        }
      }
      // Group Specific validations
      else {
        const chatId = intent.toDID
        chat = await w2wRepository.getChatByChatId({ chatId })
        if (!chat) return { success: false, error: `Invalid chatId ${chatId}` }
        // Spaces Specific validations
        if (chat.groupType === GroupType.SPACES && chat.status === ChatStatus.ENDED) {
          return {
            success: false,
            error: 'You cannot call this. The space is ended'
          }
        }

        if (chat.rules && chat.rules.entry) {
          // Evaluate the rules for the member or admin
          const rulesResult = await evaluateRules(chat.chatId, chat.rules, did)
          // If entry is false, return an error
          if (!rulesResult.entry) {
            return {
              success: false,
              error: `Access denied for address ${did} according to group rules`
            }
          }
        }

        // Private Group validations with new Encryption
        // ( Breaking Change !!! ) - Once a private grp shifts to new encryption type, it cannot go back to old encryption type
        if (chat.isPublic == false && chat.sessionKey) {
          if (!intent.encryptedSecret) {
            return {
              success: false,
              error: 'Encrypted secret are required for private groups'
            }
          }
        }

        // This means the user is joining a group with an intent. So we have to add the wallet to the combinedDID
        if (!chat.combinedDID.toLowerCase().includes(did.toLowerCase())) {
          groupAutoJoin = true

          if (chat.combinedDID.split('_').length >= NEW_MAX_GROUP_MEMBERS_PRIVATE)
            return {
              success: false,
              error: `Group chat members should be lower than ${NEW_MAX_GROUP_MEMBERS_PRIVATE}`
            }
          if (chat.admins.split('_').length >= NEW_MAX_GROUP_MEMBERS_PRIVATE)
            return {
              success: false,
              error: `Group chat admins should be lower than ${NEW_MAX_GROUP_MEMBERS_PRIVATE}`
            }
        }

        if (groupAutoJoin) {
          combinedDID = [...chat.combinedDID.split('_'), did].sort().join('_') // Add the wallet to the combinedDID
        } else {
          combinedDID = chat.combinedDID // We dont change the combined DID, because the intent needs to be accepted.
        }
      }

      // Check if intent is being approved by the same person who created by verifying the signature
      if (chat.intentSentBy === intent.toDID) {
        return { success: false, error: 'You cannot approve your own intent' }
      }

      if (!isGroup) {
        if (chat.intent.includes(intent.toDID)) {
          return { success: false, error: 'Intent already approved' }
        }
      } else {
        if (chat.intent.includes(intent.fromDID))
          return { success: false, error: 'Intent already approved' }
      }

      if (!intent.signature || !intent.sigType) {
        return { success: false, error: 'signature and sigType are required' }
      }
      /***************************** PARAM VALIDATION END **********************************/
      /************************** VERIFY VERIFICATION PROOF ********************************/
      let bodyToBeHashed: Readonly<{
        fromDID: string
        toDID: string
        status: IntentStatus
        sessionKey?: string
        encryptedSecret?: string
      }>

      switch (intent.sigType) {
        case ENCRYPTION_VERSIONS_FOR_APPROVE_INTENT.pgpv1:
          bodyToBeHashed = {
            fromDID: intent.fromDID,
            toDID: intent.toDID,
            status: intent.status
          }
          break
        case ENCRYPTION_VERSIONS_FOR_APPROVE_INTENT.pgpv2:
          bodyToBeHashed = {
            fromDID: intent.fromDID,
            toDID: intent.toDID,
            status: intent.status,
            encryptedSecret: intent.encryptedSecret
          }
          break
        default:
          return {
            success: false,
            error: 'Invalid signature type on verification proof'
          }
      }
      try {
        let encryptionKeys: EncryptionKeys | null = null
        if (isGroup) {
          encryptionKeys = await w2wRepository.getPublicKeyEncryptedPrivateKey(intent.fromDID)

          if (!encryptionKeys) {
            return {
              success: false,
              error: `User ${intent.fromDID} doesn't have encryption keys`
            }
          }
        } else {
          encryptionKeys = await w2wRepository.getPublicKeyEncryptedPrivateKey(intent.toDID)
          if (!encryptionKeys) {
            return {
              success: false,
              error: `User ${intent.toDID} doesn't have encryption keys`
            }
          }
        }

        const hash = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
        const isSignatureValid = await verifySignature({
          messageContent: hash,
          signatureArmored: intent.signature,
          publicKeyArmored: encryptionKeys.publicKeyArmored
        })
        if (!isSignatureValid) {
          return {
            success: false,
            error: 'Invalid signature'
          }
        }
      } catch (err) {
        // If signature is non-sense, for example a random string, the library will throw an exception
        logger.info('Error: %o', err)
        return {
          success: false,
          error: 'Invalid signature'
        }
      }
      /************************* VERIFY VERIFICATION PROOF END *****************************/

      const updatedIntent: string = await w2wRepository.updateIntent({
        combinedDID: combinedDID,
        status: status,
        did: did,
        isGroup,
        chatId: chat?.chatId,
        groupInformation: {
          autoJoin: groupAutoJoin
        }
      })
      if (intent.encryptedSecret) {
        const sessionKey = CryptoJs.SHA256(intent.verificationProof).toString()
        await w2wRepository.updateGroupSessionKey(chat.chatId, sessionKey)
        await w2wRepository.insertSessionKey({
          sessionKey: sessionKey,
          encryptedSecret: intent.encryptedSecret
        })
      }

      await w2wRepository.populateChatMembersByChatId(chat.chatId)

      // TODO: How to fill up these null values
      const message: Message = {
        fromDID: isGroup ? intent.fromDID : intent.toDID,
        fromCAIP10: isGroup ? intent.fromDID : intent.toDID,
        toCAIP10: isGroup ? intent.toDID : intent.fromDID,
        toDID: isGroup ? intent.toDID : intent.fromDID,
        link: null,
        messageContent: null,
        messageType: null,
        signature: intent.signature,
        timestamp: Date.now(),
        sigType: intent.sigType,
        encType: null ?? '',
        encryptedSecret: null,
        verificationProof: intent.sigType + intent.signature
      }
      const messageWithCID = { ...message, cid: null, chatId: chat?.chatId }
      sendIntentSocketEvent(
        isGroup,
        chat.groupType === GroupType.SPACES,
        isGroup ? chat.combinedDID : did,
        messageWithCID,
        MessageCategory.Approve
      )

      return { success: true, data: updatedIntent }
    } catch (e) {
      logger.error('Error: %o', e)
      return { success: false, error: 'server error' }
    }
  }

  /**
   * REJECT AN INTENT BETWEEN TWO USERS / GROUPS / SPACES
   * @dev - reject intent message is NOT inserted into the database, it is only used to update chat intent status and chat members as of now
   * @param intent intent rejection message
   */
  public async rejectIntent(intent: RejectIntent): Promise<Result> {
    const logger: Logger = Container.get('logger')
    try {
      if (intent.fromDID === intent.toDID) return { success: false, error: 'DID are the same' }
      let isGroup = false
      let combinedDID: string = null
      let chat: Chat = null
      if (!isValidCAIP10Address(intent.fromDID))
        return { success: false, error: `Invalid address ${intent.fromDID}` }
      if (!isValidCAIP10Address(intent.toDID)) {
        isGroup = true
      }
      const userFrom: UserV2 = await w2wRepository.getUserV2(intent.fromDID)
      if (!userFrom) return { success: false, error: 'No user created' }
      let userTo: UserV2 = null
      if (!isGroup) userTo = await w2wRepository.getUserV2(intent.toDID)
      if (!userTo && !isGroup) {
        return { success: false, error: 'No user created' }
      }

      const did = isGroup ? intent.fromDID : intent.toDID
      if (!isGroup) {
        const { combinedDID: combDID } = combinedWalletDID({
          firstDID: intent.toDID,
          secondDID: intent.fromDID
        })
        combinedDID = combDID
        chat = await w2wRepository.getChat({
          combinedDID: combinedDID,
          isGroup: isGroup,
          chatId: intent.toDID
        })
        if (!chat) return { success: false, error: 'There is no intent to reject' }
      } else {
        const chatId = intent.toDID
        chat = await w2wRepository.getChatByChatId({ chatId })
        if (!chat) return { success: false, error: `Invalid chatId ${chatId}` }
        if (isGroup) {
          if (chat.groupType === GroupType.SPACES) {
            if (chat.status === ChatStatus.ENDED) {
              return {
                success: false,
                error: 'You cannot call this. The space is ended'
              }
            }
          }
        }
      }

      const signature = intent.verificationProof.split(':')[1]
      const sigType = intent.verificationProof.split(':')[0]

      if (!signature || !sigType) {
        return { success: false, error: 'signature and sigType are required' }
      }
      // Signature validation
      if (signature && sigType) {
        if (sigType !== 'pgp') {
          return {
            success: false,
            error: 'Invalid signature type on verification proof'
          }
        }

        try {
          const bodyToBeHashed: Readonly<{ fromDID: string; toDID }> = {
            fromDID: intent.fromDID,
            toDID: intent.toDID
          }

          let encryptionKeys: EncryptionKeys | null = null
          if (isGroup) {
            encryptionKeys = await w2wRepository.getPublicKeyEncryptedPrivateKey(intent.fromDID)

            if (!encryptionKeys) {
              return {
                success: false,
                error: `User ${intent.fromDID} doesn't have encryption keys`
              }
            }
          } else {
            encryptionKeys = await w2wRepository.getPublicKeyEncryptedPrivateKey(intent.toDID)
            if (!encryptionKeys) {
              return {
                success: false,
                error: `User ${intent.toDID} doesn't have encryption keys`
              }
            }
          }

          const hash = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
          const isSignatureValid = await verifySignature({
            messageContent: hash,
            signatureArmored: signature,
            publicKeyArmored: encryptionKeys.publicKeyArmored
          })
          if (!isSignatureValid) {
            return {
              success: false,
              error: 'Invalid signature'
            }
          }
        } catch (err) {
          logger.info('Error: %o', err)
          return {
            success: false,
            error: 'Invalid signature'
          }
        }
      }

      if (!chat.intentSentBy) {
        const returnMessage = 'Error in intent'
        logger.info(returnMessage)
        return { success: false, error: returnMessage }
      }

      // Check if intent is being approved by the same person who created by verifying the signature
      if (chat.intentSentBy === intent.toDID) {
        return { success: false, error: 'You cannot reject your own intent' }
      }

      if (!chat.combinedDID.includes(did)) {
        return { success: false, error: 'User not part of the group' }
      }

      if (chat.intent.includes(intent.toDID)) {
        return { success: false, error: 'Intent already approved' }
      }

      await w2wRepository.rejectIntent({
        combinedDID: combinedDID,
        did: did,
        isGroup,
        chatId: chat?.chatId
      })

      if (isGroup) {
        await w2wRepository.deleteChatMember({ chatId: chat.chatId, did: did })
      } else {
        await w2wRepository.deleteChatMembers(chat.chatId)
      }

      // TODO: How to fill up these null values
      const message: Message = {
        fromDID: isGroup ? intent.fromDID : intent.toDID,
        fromCAIP10: isGroup ? intent.fromDID : intent.toDID,
        toCAIP10: isGroup ? intent.toDID : intent.fromDID,
        toDID: isGroup ? intent.toDID : intent.fromDID,
        link: null,
        messageContent: null,
        messageType: null,
        signature: signature,
        timestamp: Date.now(),
        sigType: sigType,
        encType: null ?? '',
        encryptedSecret: null,
        verificationProof: sigType + signature
      }
      const messageWithCID = { ...message, cid: null, chatId: chat?.chatId }
      sendIntentSocketEvent(
        isGroup,
        chat.groupType === GroupType.SPACES,
        isGroup ? chat.combinedDID : did,
        messageWithCID,
        MessageCategory.Reject
      )

      return { success: true }
    } catch (e) {
      logger.error('Error: %o', e)
      return { success: false, error: 'server error' }
    }
  }

  /**
   * CREATES A MESSAGE BETWEEN TWO USERS / GROUPS / SPACES
   * @param messageDTO message sent by the user
   */
  public async createMessage(messageDTO: MessageDTO): Promise<Result> {
    const logger: Logger = Container.get('logger')
    try {
      /**
       * PARAM VALIDATIONS
       */
      if (!messageDTO.messageType) {
        return { success: false, error: 'Invalid MessageType' }
      }
      if (!['PlainText', 'pgp', 'pgpv1:group'].includes(messageDTO.encType)) {
        return { success: false, error: 'Invalid encryption type' }
      }
      if (messageDTO.fromDID === messageDTO.toDID) {
        const returnMessage = "You can't send message to yourself"
        return { success: false, error: returnMessage }
      }
      if (
        messageDTO.fromCAIP10 !== messageDTO.fromDID ||
        messageDTO.toCAIP10 !== messageDTO.toDID
      ) {
        return { success: false, error: 'Invalid from or to address' }
      }
      if (
        !isValidCAIP10Address(messageDTO.fromCAIP10) ||
        !isValidCAIP10Address(messageDTO.fromDID)
      ) {
        return { success: false, error: 'Invalid from address' }
      }
      /**
       * VERIFICATION PROOF VALIDATIONS
       */
      try {
        await this.verifyMessageVerificationProof(messageDTO)
      } catch (err) {
        return { success: false, error: err.message }
      }
      /**
       * SIZE VALIDATIONS
       */
      if (getSizeInBytes(messageDTO) > MAX_SIZE_BYTES_PER_MESSAGE) {
        return { success: false, error: 'Message paylaod is over the maximum limit' }
      }

      // Check if message is for a group
      let isGroup = false
      let chat: Chat = null
      let combinedDID: string = null
      if (!isValidCAIP10Address(messageDTO.toCAIP10) || !isValidCAIP10Address(messageDTO.toDID)) {
        const chatId = messageDTO.toCAIP10
        chat = await w2wRepository.getChatByChatId({ chatId })
        if (!chat) return { success: false, error: 'Invalid chatId' }
        isGroup = true
      }
      /**
       * META MESSAGE VALIDATIONS
       */
      if (
        !isGroup &&
        (messageDTO.messageType === 'Meta' || messageDTO.messageType === 'UserActivity')
      ) {
        return { success: false, error: 'Meta Messages are only allowed in Group Chat' }
      } else if (isGroup && messageDTO.messageType === 'Meta') {
        const isAdmin = await w2wRepository.isAddressAdminWithIntentInGroup(
          messageDTO.toDID,
          messageDTO.fromDID
        )
        if (!isAdmin) {
          return {
            success: false,
            error: 'Meta Messages are only allowed to be sent by Group Admins'
          }
        }
      }

      const getchatRedisKey = (chatId: string, userId: string) => `chat:${chatId}:${userId}`

      if (isGroup) {
        const intent = await w2wRepository.checkMemberIntentForGroup(
          messageDTO.toDID,
          messageDTO.fromDID
        )
        if (intent === null) {
          return { success: false, error: 'You cannot send message to this group' }
        }
        if (!intent) {
          return { success: false, error: 'You must first approve the intent' }
        }

        const redisKey = getchatRedisKey(chat.chatId, messageDTO.fromDID)
        const cachedAccess = await redisClient.get(redisKey)

        if (!cachedAccess && chat.rules && chat.rules.chat) {
          // Evaluate the rules for the member or admin
          const rulesResult = await evaluateRules(chat.chatId, chat.rules, messageDTO.fromDID)

          if (rulesResult.chat) {
            await redisClient.set(redisKey, 'true') // 'true' indicates chat is granted.
            await redisClient.expire(redisKey, 86400) // expire in 24 hours
          } else {
            // If chat is false, return an error
            return {
              success: false,
              error: `Access denied for address ${messageDTO.fromDID} according to group rules`
            }
          }
        }

        if (chat.groupType === GroupType.SPACES) {
          const currentTime = new Date().getTime()
          const scheduleAt = new Date(chat.scheduleAt).getTime()
          const scheduleEnd = chat.scheduleEnd ? new Date(chat.scheduleEnd).getTime() : null

          const FIFTEEN_MINUTES = 15 * 60 * 1000 // 15 minutes in milliseconds

          if (
            currentTime < scheduleAt - FIFTEEN_MINUTES ||
            (scheduleEnd !== null && currentTime > scheduleEnd)
          ) {
            return {
              success: false,
              error: 'You can only send messages in the allowed time frame for spaces types'
            }
          }

          if (chat.status !== ChatStatus.ACTIVE) {
            return {
              success: false,
              error: 'You cannot send messages to a chat that is not active'
            }
          }
        }
        combinedDID = chat.combinedDID

        if (!chat.isPublic) {
          // Check if message encryption type is allowed for the group
          if (messageDTO.encType === 'pgpv1:group') {
            if (!messageDTO.sessionKey) {
              return { success: false, error: 'sessionKey is required' }
            }
            // sessionKey in message should be the same as stored in the database
            if (messageDTO.sessionKey !== chat.sessionKey) {
              return { success: false, error: 'Invalid sessionKey' }
            }
            // secretKey should be null when sessionKey is present
            if (messageDTO.encryptedSecret) {
              return { success: false, error: 'encryptedSecret should be null' }
            }
          }
          // TODO: Decide if we need to either block or let legacy users use the slow encrypted msg
          // else if (messageDTO.encType === 'pgp') {
          //   //  Breaking change !!!
          //   // This encryption is too slow so its better to break it
          //   if (chat.intent.split('+').length > MAX_GROUP_MEMBERS_PRIVATE) {
          //     return {
          //       success: false,
          //       error: `You cannot send a message with encryption type pgp to a private group with more than ${MAX_GROUP_MEMBERS_PRIVATE} members`
          //     }
          //   }
          // }
        }
      } else {
        const { combinedDID: combDID } = combinedWalletDID({
          firstDID: messageDTO.toDID,
          secondDID: messageDTO.fromDID
        })
        combinedDID = combDID
        const hasIntent: boolean = await w2wRepository.hasIntent({ combinedDID: combinedDID })
        if (!hasIntent) {
          const returnMessage = 'There is no intent between users'
          logger.debug(returnMessage)
          return { success: false, error: returnMessage }
        }
      }

      const userFrom: UserV2 = await w2wRepository.getUserV2(messageDTO.fromDID)
      if (!isGroup) {
        const userTo = await w2wRepository.getUserV2(messageDTO.toDID)
        const blockStatus = await checkBlockStatus(userFrom, userTo)
        if (!blockStatus.success) {
          logger.info(blockStatus.error)
          return blockStatus
        }
      }
      /**
       * BUILD MESSAGE
       */
      const reference: string = this.createMessageReference(messageDTO)
      const latestMessageReference: string | null = await w2wRepository.getLatestThreadhash({
        combinedDID: combinedDID,
        isGroup,
        chatId: chat?.chatId
      })
      const message: Message = {
        ...messageDTO,
        link: latestMessageReference === null ? null : `previous:${reference}`
      }
      /**
       * INSERT MESSAGE
       */
      const messages = {
        messagesSent: userFrom.msgSent,
        messagesMax: userFrom.maxMsgPersisted
      }
      // Check if either messagesSent or messagesMax is undefined or null
      if (messages.messagesSent == null || messages.messagesMax == null) {
        return { success: false, error: 'Error in user information' }
      }
      const chatFromDB: Chat = await w2wRepository.getChat({
        combinedDID: combinedDID,
        isGroup,
        chatId: chat?.chatId
      })
      await this.insertMessage(reference as `v2:${string}`, message, chatFromDB.chatId)
      w2wRepository.updateThreadHash({
        threadhash: reference,
        combinedDID: combinedDID,
        isGroup,
        chatId: chat?.chatId
      })
      /**@dev - Update sent message counter only when less than max limit */
      if (messages.messagesSent < messages.messagesMax) {
        w2wRepository.updateMessagesSent(1, message.fromDID)
      }
      const createdMessage = { ...message, cid: reference, chatId: chat?.chatId }

      /**
       * SEND PUSH NOTIFICATION TO RECEIVER
       * @dev - Asynchronously send push notification to receiver
       */
      this.sendNotification(
        PUSH_CHAT_NOTIFICATION.CREATE_MESSAGE,
        message.fromDID,
        chatFromDB.chatId,
        message.signature,
        message.messageContent
      )
      /**
       * SEND SOCKET EVENT TO RECEIVER
       * @dev - Asynchronously send socket event to receiver
       */
      sendMessageSocketEvent(isGroup, combinedDID, createdMessage, chatFromDB.chatId)
      /**
       * RETURN RESPONSE
       */
      return { success: true, data: createdMessage }
    } catch (e) {
      logger.error('Error: %o', e)
      return { success: false, error: 'server error' }
    }
  }

  public async getChatInfo(req: Request, res: Response): Promise<Response> {
    if (req.params.recipient.startsWith('eip155')) {
      return getOneToOneChatInfo(req, res)
    } else {
      return getChatStatusWithChatId(req, res)
    }
  }

  /**
   * GET MESSAGES FOR A CHAT FROM A GIVEN REFERENCE OR PREVIOUS REFERENCE
   * @dev - returns messages for a chat which were sent before a given reference ( including the message with the given reference )
   */
  public async getMessages(req: Request, res: Response): Promise<Response> {
    const logger: Logger = Container.get('logger')
    try {
      /**
       * @dev - Threadhash can be a reference or a previous reference
       */
      const threadHash = req.params.threadhash as `v2:${string}` | `previous:v2:${string}`
      const limit = parseInt(req.query.fetchLimit as string)
      const reference = await w2wRepository.getReferenceFromThreadhash(threadHash)
      const messages = await w2wRepository.getMessagesFromReference(reference, limit)
      return res.status(200).json(messages)
    } catch (err) {
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * REMOVE EXPIRED GROUPS
   * @dev Used for spaces currently
   * @dev Chat is removed from w2w_meta | Chat members are removed from chat_members | Chat messages are removed from DB, fileStorage and unpinned from IPFS
   * @dev This function is called by a cron job
   */
  public async batchRemoveExpiredGroups(): Promise<void> {
    const logger: Logger = Container.get('logger')
    logger.debug('Trying to call batchRemoveExpiredGroups (50 at a time)')
    const LIMIT = 50
    const expiredChatIds = await w2wRepository.getExpiredGroups(LIMIT)
    logger.debug(`Found ${expiredChatIds.length} expired groups`)
    for (const chatId of expiredChatIds) {
      try {
        // delete chat
        await w2wRepository.deleteExpiredGroup(chatId)
        // delete chat members
        await w2wRepository.deleteChatMembers(chatId)
        // remove chat messages
        await this.removeMessagesForChatId(chatId)
      } catch (e) {
        logger.error('Error: %o', e)
      }
    }
    logger.info('Finished batchRemoveExpiredGroups')
  }

  /**
   * GROUP RULES HELPER FUNCTION
   */
  static rulesAreEqual(rules1: any, rules2: any): boolean {
    if (rules1 === null) rules1 = {}
    if (rules2 === null) rules2 = {}
    return JSON.stringify(rules1) === JSON.stringify(rules2)
  }

  /**
   * GROUP META HELPER FUNCTION
   */
  static metaAreEqual(meta1: any, meta2: any): boolean {
    return (meta1 === null || meta1 === undefined) && (meta2 === null || meta2 === undefined)
  }

  /**
   * CREATE GROUP V1
   * @deprecated
   * @notice - This Fn is not recommended to be used in future, use @createGroupV2 instead
   * @dev - Creates a Group of type 'v1' which has 1 verification proof for all group changes ( this has been changed in v2 )
   */
  public async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const logger: Logger = Container.get('logger')
      const groupChat: GroupChat = {
        groupName: req.body.groupName,
        groupDescription: req.body.groupDescription,
        members: req.body.members,
        groupImage: req.body.groupImage,
        admins: req.body.admins,
        isPublic: req.body.isPublic,
        contractAddressNFT: req.body.contractAddressNFT,
        numberOfNFTs: req.body.numberOfNFTs,
        contractAddressERC20: req.body.contractAddressERC20,
        numberOfERC20: req.body.numberOfERC20,
        groupCreator: req.body.groupCreator,
        verificationProof: req.body.verificationProof,
        meta: req.body?.meta ?? null,
        scheduleAt: req.body.scheduleAt,
        scheduleEnd: req.body.scheduleEnd,
        groupType: req.body.groupType,
        status: [GroupType.SPACES].includes(req.body.groupType) ? ChatStatus.PENDING : null,
        sessionKey: null,
        rules: req.body.rules
      }

      groupChat.groupType = req.body.groupType || GroupType.DEFAULT

      if (!Object.values(GroupType).includes(groupChat.groupType)) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidGroupType,
          'Invalid group type',
          `Provided group type '${groupChat.groupType}' is not valid.`
        )
      }

      // The limit for group chats is different for a public to a private group.
      // The reason for this is because for public groups it's being used by Gitcoin and because the encryption for large groups on private groups take a long time for large groups
      if (groupChat.isPublic) {
        if (groupChat.members.length > MAX_GROUP_MEMBERS_PUBLIC) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.MaxGroupMembersExceededPublic,
            'Exceeded max group members for public group',
            `Group chat members should be lower than ${MAX_GROUP_MEMBERS_PUBLIC}.`
          )
        }
        if (groupChat.admins.length > MAX_GROUP_MEMBERS_PUBLIC) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.MaxGroupAdminsExceededPublic,
            'Exceeded max group admins for public group',
            `Group chat admins should be lower than ${MAX_GROUP_MEMBERS_PUBLIC}.`
          )
        }
      } else {
        if (groupChat.members.length > NEW_MAX_GROUP_MEMBERS_PRIVATE) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.MaxGroupMembersExceededPrivate,
            'Exceeded max group members for private group',
            `Group chat members should be lower than ${NEW_MAX_GROUP_MEMBERS_PRIVATE} for private groups.`
          )
        }
      }

      if (groupChat.groupType === GroupType.SPACES && !groupChat.scheduleAt) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.MissingScheduleForSpaces,
          'Missing schedule',
          'scheduleAt is required for spaces types.'
        )
      }

      if (groupChat.scheduleAt) {
        const start = new Date(groupChat.scheduleAt)
        const now = new Date()

        if (start < now) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.InvalidScheduleStartTime,
            'Invalid schedule start time',
            'Schedule start time must be in the future.'
          )
        }

        if (groupChat.scheduleEnd) {
          const end = new Date(groupChat.scheduleEnd)

          if (end < now) {
            throw new ValidationError(
              HttpStatus.BadRequest,
              CommonErrors.InvalidScheduleEndTime,
              'Invalid schedule end time',
              'Schedule end time must be in the future.'
            )
          }

          if (start >= end) {
            throw new ValidationError(
              HttpStatus.BadRequest,
              CommonErrors.InvalidScheduleTimeRange,
              'Invalid schedule time range',
              'Schedule start time must be earlier than end time.'
            )
          }
        }
      }

      if (groupChat.rules) {
        const ruleErrors = await validateRules(groupChat.rules)
        if (ruleErrors.length > 0) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.RuleValidationFailed,
            'Rule validation failed',
            JSON.stringify({ errors: ruleErrors })
          )
        }
      }

      const setAdmins = new Set(groupChat.admins)
      const setMembers = new Set(groupChat.members)
      if (
        setAdmins.size !== groupChat.admins.length ||
        setMembers.size !== groupChat.members.length
      ) {
        return res.status(400).send('Duplicated item in array of admins or members')
      }
      // token-gated group tokens validation
      const tokenValidation = async (address: string): Promise<{ err: string | null }> => {
        if (groupChat.contractAddressERC20 !== null) {
          if (groupChat.numberOfERC20 === 0)
            return { err: 'Number of ERC20 should be greater than 0' }
          const numberERC20Tokens = await numberOfERC20Tokens(
            groupChat.contractAddressERC20,
            address
          )
          if (numberERC20Tokens.err) return { err: numberERC20Tokens.err }
          if (ethers.BigNumber.from(groupChat.numberOfERC20).gt(numberERC20Tokens.result))
            return { err: 'Invalid number of tokens to be part of the group' }
          return { err: null }
        }
        if (groupChat.contractAddressNFT !== null) {
          if (groupChat.numberOfNFTs === 0)
            return { err: 'Number of ERC721 tokens should be greater than 0' }
          const numberNFTTokens = await numberOfNFTTokens(groupChat.contractAddressNFT, address)
          if (numberNFTTokens.err) return { err: numberNFTTokens.err }
          if (ethers.BigNumber.from(groupChat.numberOfNFTs).gt(numberNFTTokens.result))
            return { err: 'Invalid number of tokens to be part of the group' }
          return { err: null }
        }
      }

      if (
        groupChat.contractAddressERC20 &&
        !isValidActualCAIP10Address(groupChat.contractAddressERC20)
      )
        return res.status(400).json('Invalid Contract Address ERC20')
      if (groupChat.contractAddressNFT && !isValidActualCAIP10Address(groupChat.contractAddressNFT))
        return res.status(400).json('Invalid Contract Address NFT')
      const validation = await tokenValidation(groupChat.groupCreator)
      if (validation && validation.err) return res.status(400).json(validation.err)
      for (const address of groupChat.admins) {
        if (!isValidCAIP10Address(address)) return res.status(400).json('Invalid admin address')
        const validation = await tokenValidation(address)
        if (validation && validation.err) return res.status(400).json(validation.err)
        // When adding an admin, the address will automatically become a member
        if (groupChat.members.includes(address))
          return res.status(400).json(`Admin address ${address} is present on members array`)
      }
      for (const address of groupChat.members) {
        if (!isValidCAIP10Address(address)) return res.status(400).json('Invalid members address')
        const validation = await tokenValidation(address)
        if (validation && validation.err) return res.status(400).json(validation.err)
      }

      if (!isValidCAIP10Address(groupChat.groupCreator))
        return res.status(400).json('Invalid group creator address')
      // For token gated channels, the admin array should be empty
      if (groupChat.contractAddressERC20 !== null || groupChat.contractAddressNFT !== null) {
        if (groupChat.admins.length !== 0)
          return res.status(400).json('Admin array should be empty')
      }

      let totalGroupsCreated
      if (groupChat.groupType === GroupType.SPACES) {
        totalGroupsCreated = await w2wRepository.getCountSpaces({
          did: groupChat.groupCreator
        })
      } else {
        totalGroupsCreated = await w2wRepository.getCountGroupChats({
          did: groupChat.groupCreator
        })
      }

      const maxGroups =
        groupChat.groupType === GroupType.SPACES ? MAX_SPACES_CAN_CREATE : MAX_GROUPS_CAN_CREATE
      if (totalGroupsCreated >= maxGroups) {
        return res
          .status(400)
          .json(
            `Address can only create up to ${maxGroups} ${
              groupChat.groupType === GroupType.SPACES ? 'spaces' : 'groups'
            }`
          )
      }

      if (groupChat.groupImage) {
        const messageSizeInBytes = getSizeInBytes(groupChat.groupImage)
        if (messageSizeInBytes / (1024 * 1024) > 2)
          return res.status(400).json('Group image too big')
      }
      if (groupChat.members.includes(groupChat.groupCreator))
        return res.status(400).json('Group Creator address should not be on members array')
      if (groupChat.admins.includes(groupChat.groupCreator))
        return res.status(400).json('Group Creator address should not be on admins array')

      const groupCreator = await w2wRepository.getUserV2(groupChat.groupCreator)

      if (!groupCreator) {
        return res.status(400).json('Group creator profile is not present')
      }
      // Determine the encryption type
      const pgpEncType = await w2wRepository.getPgpEncType(groupCreator.encryptedPrivateKey)
      // Parse the public key based on the encryption type
      let publicKeyArmored
      if (pgpEncType === ENC_TYPE_V2 || pgpEncType === ENC_TYPE_V3 || pgpEncType === ENC_TYPE_V4) {
        publicKeyArmored = JSON.parse(groupCreator.publicKey).key
      } else {
        publicKeyArmored = groupCreator.publicKey
      }

      if (!publicKeyArmored || !groupCreator.encryptedPrivateKey) {
        return res.status(400).json("Group creator doesn't have encryption keys")
      }

      // Create an EncryptionKeys object from the UserV2 object.
      const encryptionKeys = {
        publicKeyArmored: publicKeyArmored,
        encryptedPrivateKey: groupCreator.encryptedPrivateKey
      }

      // Create a Set with members and admins
      const membersAndAdmins = new Set([...groupChat.members, ...groupChat.admins])

      // Loop over each unique member/admin
      for (const memberOrAdmin of membersAndAdmins) {
        const user = await w2wRepository.getUserV2(memberOrAdmin)

        // If the user doesn't exist, continue to the next iteration
        if (!user) continue

        // Use the checkBlockStatus function to check if either user has blocked the other
        const blockStatus = await checkBlockStatus(groupCreator, user)
        if (!blockStatus.success) {
          logger.info(blockStatus.error)
          return res.status(400).json(blockStatus.error)
        }
      }

      // Loop over each unique new member/admin
      for (const memberOrAdmin of membersAndAdmins) {
        // Skip the check if the member is the group creator
        if (memberOrAdmin === groupChat.groupCreator) {
          continue
        }

        if (groupChat.rules && groupChat.rules.entry) {
          // Evaluate the rules for the member or admin
          const rulesResult = await evaluateRules(null, groupChat.rules, memberOrAdmin)

          // If entry is false, return an error
          if (!rulesResult.entry) {
            return res
              .status(403)
              .json(`Access denied for address ${memberOrAdmin} according to group rules`)
          }
        }
      }

      let bodyToBeHashed: Omit<
        GroupChat,
        'verificationProof' | 'groupType' | 'scheduleAt' | 'scheduleEnd' | 'status'
      >
      try {
        // TODO: We have to add to the body the groupType. For this we need to version the bodyToBeHashed so the backend can know which properties to include in the json to be hashed
        bodyToBeHashed = {
          groupName: groupChat.groupName,
          groupDescription: groupChat.groupDescription,
          members: groupChat.members,
          groupImage: groupChat.groupImage,
          admins: groupChat.admins,
          isPublic: groupChat.isPublic,
          contractAddressNFT: groupChat.contractAddressNFT,
          numberOfNFTs: groupChat.numberOfNFTs,
          contractAddressERC20: groupChat.contractAddressERC20,
          numberOfERC20: groupChat.numberOfERC20,
          groupCreator: groupChat.groupCreator
        }
        const [sigType, signature, address] = groupChat.verificationProof.split(':')
        if (sigType !== 'pgp')
          return res.status(400).json('Invalid signature type on verification proof')
        const hash = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
        const isSignatureValid = await verifySignature({
          messageContent: hash,
          signatureArmored: signature,
          publicKeyArmored: encryptionKeys.publicKeyArmored
        })
        if (!isSignatureValid) {
          return res.status(400).json('Invalid signature')
        }
      } catch (err) {
        // If signature is non-sense, for example a random string, the library will throw an exception
        logger.info('Error: %o', err)
        return res.status(400).json('Invalid signature')
      }

      let combinedDID = groupChat.groupCreator
      let admins = groupChat.groupCreator
      if (groupChat.members.length !== 0) combinedDID += '_' + groupChat.members.join('_')
      if (groupChat.admins.length !== 0) combinedDID += '_' + groupChat.admins.join('_')
      if (groupChat.admins.length !== 0) admins += '_' + groupChat.admins.join('_')
      // sort combinedDID
      combinedDID = combinedDID.split('_').sort().join('_')
      // for token-gated groups, all the members added are admins
      if (groupChat.contractAddressNFT !== null || groupChat.contractAddressERC20 !== null) {
        admins = combinedDID
      }

      let chatId = CryptoJs.SHA256(
        JSON.stringify({
          groupName: groupChat.groupName,
          members: groupChat.members,
          admins: groupChat.admins,
          timestamp: Date.now()
        })
      ).toString()
      if (groupChat.groupType === 'spaces') {
        chatId = `spaces:${chatId}`
      }
      const chat: Chat = {
        combinedDID,
        chatId: chatId,
        groupName: groupChat.groupName,
        groupDescription: groupChat.groupDescription,
        groupImage: groupChat.groupImage,
        intentSentBy: groupChat.groupCreator,
        intent: groupChat.groupCreator,
        threadhash: null,
        admins: admins,
        isPublic: groupChat.isPublic,
        contractAddressNFT: groupChat.contractAddressNFT,
        numberOfNFTs: groupChat.numberOfNFTs,
        contractAddressERC20: groupChat.contractAddressERC20,
        numberOfERC20: groupChat.numberOfERC20,
        verificationProof: groupChat.verificationProof,
        meta: groupChat.meta,
        scheduleAt: groupChat.scheduleAt,
        scheduleEnd: groupChat.scheduleEnd,
        groupType: groupChat.groupType,
        status: groupChat.status,
        sessionKey: groupChat.sessionKey,
        rules: groupChat.rules,
        groupVersion: 'v1',
        profileVerificationProof: null,
        configVerificationProof: null
      }
      await w2wRepository.createGroup(chat)
      await w2wRepository.populateChatMembersByChatId(chatId)
      logger.info(`Created group with chatId: ${chat.chatId}`)
      const group = await getGroupDTO(chat.chatId)

      if (group.groupType === GroupType.SPACES) {
        const space = convertGroupToSpace(group)
        this.sendSpaceNotification(space, PUSH_CHAT_NOTIFICATION.CREATE_SPACE)
        sendSpaceSocketEvent(combinedDID, space, SpaceEventType.create, groupChat.groupCreator)
      } else {
        // Send Push Notification
        const signedHash = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
        this.sendNotification(
          PUSH_CHAT_NOTIFICATION.CREATE_GROUP,
          groupChat?.groupCreator,
          chatId,
          groupChat?.verificationProof.split(':')[1],
          signedHash
        )
        sendGroupSocketEvent(combinedDID, group, GroupEventType.create, groupChat.groupCreator)
      }

      handleEmptyUsers(group)
      return res.status(200).send(group)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * UPDATE GROUP
   * @deprecated
   * @notice - This Fn is not recommended to be used in future, use @updateGroupProfile and @updateGroupMembers instead
   */
  public async updateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const updateGroup: UpdateGroup & { chatId: string } = {
        chatId: req.params.chatId,
        groupName: req.body.groupName,
        groupDescription: req.body.groupDescription,
        groupImage: req.body.groupImage,
        members: req.body.members,
        admins: req.body.admins,
        address: req.body.address,
        verificationProof: req.body.verificationProof,
        meta: req.body.meta,
        scheduleAt: req.body.scheduleAt,
        scheduleEnd: req.body.scheduleEnd,
        status: req.body.status,
        rules: req.body.rules,
        encryptedSecret: req.body.encryptedSecret
      }

      if (updateGroup.scheduleAt) {
        const start = new Date(updateGroup.scheduleAt)
        const now = new Date()

        if (start < now && updateGroup.status === ChatStatus.PENDING) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.InvalidScheduleStartTime,
            'Invalid schedule start time',
            'Schedule start time must be in the future.'
          )
        }

        if (updateGroup.scheduleEnd) {
          const end = new Date(updateGroup.scheduleEnd)

          if (end < now) {
            throw new ValidationError(
              HttpStatus.BadRequest,
              CommonErrors.InvalidScheduleEndTime,
              'Invalid schedule end time',
              'Schedule end time must be in the future.'
            )
          }

          if (start >= end) {
            throw new ValidationError(
              HttpStatus.BadRequest,
              CommonErrors.InvalidScheduleTimeRange,
              'Invalid schedule time range',
              'Schedule start time must be earlier than end time.'
            )
          }
        }
      }

      if (updateGroup.rules) {
        const ruleErrors = await validateRules(updateGroup.rules)
        if (ruleErrors.length > 0) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.InvalidGroupRules,
            'Rule validation failed',
            JSON.stringify({ errors: ruleErrors })
          )
        }
      }

      if (updateGroup.status == ChatStatus.ENDED && !updateGroup.scheduleEnd) {
        updateGroup.scheduleEnd = new Date()
      }
      const groupChat: Chat = await w2wRepository.getChatByChatId({ chatId: updateGroup.chatId })
      if (!groupChat) {
        throw new ValidationError(
          HttpStatus.NotFound,
          CommonErrors.ChatNotFound,
          'No group chat found',
          `No group with chatId ${updateGroup.chatId}`
        )
      }
      if (
        groupChat.groupType === GroupType.SPACES &&
        updateGroup.status === ChatStatus.ACTIVE &&
        groupChat.status === ChatStatus.PENDING
      ) {
        const currentTime = new Date()
        const difference =
          (new Date(groupChat.scheduleAt).getTime() - currentTime.getTime()) / 1000 / 60 // in minutes

        if (difference > 15) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.StreamStartLimitExceeded,
            'Stream start limit exceeded',
            'Spaces can only start the stream up to 15 minutes before the scheduled time'
          )
        }
      }

      if (groupChat.groupType === GroupType.SPACES && groupChat.status === ChatStatus.ENDED) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.UpdateNotAllowedOnEndedSpace,
          'Update not allowed on ended space',
          'No updates allowed on the space which is ended'
        )
      }

      const setMembers = new Set(updateGroup.members)
      const setAdmins = new Set(updateGroup.admins)
      if (updateGroup.members) {
        if (setMembers.size !== updateGroup.members.length) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.DuplicatedAdminOrMember,
            'Duplicate members error',
            'Duplicated elements in members array'
          )
        }
      }

      if (updateGroup.admins) {
        if (setAdmins.size !== updateGroup.admins.length) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.DuplicatedAdminOrMember,
            'Duplicate admins error',
            'Duplicated element in admins array'
          )
        }
      }

      // token-gated group tokens validation
      const hasNecessaryTokensForTokenGatedGroup = async (
        address: string
      ): Promise<{ success: boolean; err: string; address: string }> => {
        if (groupChat.contractAddressERC20 !== null) {
          const numberERC20Tokens = await numberOfERC20Tokens(
            groupChat.contractAddressERC20,
            address
          )
          if (numberERC20Tokens.err) return { success: false, err: numberERC20Tokens.err, address }
          if (ethers.BigNumber.from(groupChat.numberOfERC20).gt(numberERC20Tokens.result))
            return {
              success: false,
              err: `Address ${address} has ${numberERC20Tokens.result} and not ${groupChat.numberOfERC20}`,
              address
            }
        }
        if (groupChat.contractAddressNFT !== null) {
          const numberNFTTokens = await numberOfNFTTokens(groupChat.contractAddressNFT, address)
          if (numberNFTTokens.err) return { success: false, err: numberNFTTokens.err, address }
          if (ethers.BigNumber.from(groupChat.numberOfNFTs).gt(numberNFTTokens.result))
            return {
              success: false,
              err: `Address ${address} has ${numberNFTTokens.result} and not ${groupChat.numberOfNFTs}`,
              address
            }
        }

        if (groupChat?.meta !== null && groupChat?.meta.includes('gitcoin')) {
          const projectId: string | null =
            groupChat.meta.split(':').length > 1 ? groupChat.meta.split(':')[1] : null
          if (projectId) {
            const isValidGitcoinDoner = await verifyGitcoinDonner(projectId, address.split(':')[1])
            if (!isValidGitcoinDoner || !isValidGitcoinDoner.result) {
              return { success: false, err: 'Not a donator to gitcoin project', address }
            }
          }
        }
        return { success: true, err: null, address }
      }

      if (
        !updateGroup.members &&
        !updateGroup.admins &&
        !updateGroup.groupName &&
        !updateGroup.groupImage
      ) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.NoUpdateParametersProvided,
          'No update parameters provided',
          'No parameter set to be updated'
        )
      }
      if (!isValidCAIP10Address(updateGroup.address)) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAddress,
          'Invalid address',
          `Invalid address ${updateGroup.address}`
        )
      }
      if (!groupChat) {
        throw new ValidationError(
          HttpStatus.NotFound,
          CommonErrors.ChatNotFound,
          'No group chat found',
          `No group with chatId ${updateGroup.chatId}`
        )
      }

      if (updateGroup.members.length === 0 || updateGroup.admins.length === 0) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.EmptyMembersOrAdminsArray,
          'Empty members or admins array',
          'Members or admins array cannot be of size 0'
        )
      }
      // The limit for group chats is different for a public to a private group.
      // The reason for this is because for public groups it's being used by Gitcoin and because the encryption for large groups on private groups take a long time for large groups
      if (groupChat.isPublic) {
        if (updateGroup.members.length > MAX_GROUP_MEMBERS_PUBLIC) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.MaxGroupMembersExceededPublic,
            'Exceeded max group members for public group',
            `Group chat members should be lower than ${MAX_GROUP_MEMBERS_PUBLIC}`
          )
        }

        if (updateGroup.admins.length > MAX_GROUP_MEMBERS_PUBLIC) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.MaxGroupMembersExceededPublic,
            'Exceeded max group admins for public group',
            `Group chat admins should be lower than ${MAX_GROUP_MEMBERS_PUBLIC}`
          )
        }
      } else {
        if (updateGroup.members.length > NEW_MAX_GROUP_MEMBERS_PRIVATE) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.MaxGroupMembersExceededPublic,
            'Exceeded max group members for private group',
            `Group chat members should be lower than ${NEW_MAX_GROUP_MEMBERS_PRIVATE}`
          )
        }

        if (updateGroup.admins.length > NEW_MAX_GROUP_MEMBERS_PRIVATE) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.MaxGroupMembersExceededPublic,
            'Exceeded max group admins for private group',
            `Group chat admins should be lower than ${NEW_MAX_GROUP_MEMBERS_PRIVATE}`
          )
        }
        // Compare current grp members with updated grp members. If there is only some additional member, then sessionKey is noy required. Only required if some grp member is removed

        // Non Pending Group Participants ( can be admin or member)
        const nonPendingParticipants = groupChat.intent
          .split('+')
          .map((participant) => participant.toLowerCase())
        const updatdParticipantsSet = new Set(
          updateGroup.members.map((participant) => participant.toLowerCase())
        )

        let sameMembers = true
        nonPendingParticipants.map((element) => {
          if (!updatdParticipantsSet.has(element)) {
            sameMembers = false
          }
        })

        if (!sameMembers) {
          const sessionKey = CryptoJs.SHA256(updateGroup.verificationProof).toString()
          if (groupChat.sessionKey && !updateGroup.encryptedSecret) {
            throw new ValidationError(
              HttpStatus.BadRequest,
              CommonErrors.EncryptedSecretRequired,
              'Encrypted secret required',
              'Encrypted secret are required for private groups'
            )
          }
          if (groupChat.sessionKey && sessionKey === groupChat.sessionKey) {
            throw new ValidationError(
              HttpStatus.BadRequest,
              CommonErrors.SameSessionKeyError,
              'Session key error',
              'Session key is the same as the old session key'
            )
          }
        }
      }

      // For changing group name and description, only the group creator can do this. Admins can add and remove members but changing group name and description only the group creator
      if (
        groupChat.groupName !== updateGroup.groupName ||
        groupChat.groupDescription !== updateGroup.groupDescription ||
        groupChat.groupImage !== updateGroup.groupImage
      ) {
        if (groupChat.intentSentBy !== updateGroup.address) {
          const entityType = groupChat.groupType === GroupType.SPACES ? 'space' : 'group'

          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.UnauthorizedGroupChange,
            'Unauthorized group change',
            `Only the address ${groupChat.intentSentBy} can change ${entityType} name, ${entityType} description, or ${entityType} image`
          )
        }
      }

      if (
        (groupChat.groupName !== updateGroup.groupName ||
          groupChat.groupDescription !== updateGroup.groupDescription ||
          groupChat.groupImage !== updateGroup.groupImage ||
          !ChatService.rulesAreEqual(groupChat.rules, updateGroup.rules)) &&
        groupChat.status !== ChatStatus.PENDING &&
        groupChat.groupType === GroupType.SPACES
      ) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.SpaceActiveChangeNotAllowed,
          'Space active change not allowed',
          'Changes to space name, space description, spaces rules or space image are not allowed once the space is active'
        )
      }

      const groupUpdater = await w2wRepository.getUserV2(updateGroup.address)

      if (!groupUpdater) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.GroupUpdaterProfileMissing,
          'Group updater profile missing',
          'Group updater profile is not present'
        )
      }
      // Determine the encryption type
      const pgpEncType = w2wRepository.getPgpEncType(groupUpdater.encryptedPrivateKey)

      // Parse the public key based on the encryption type
      let publicKeyArmored
      if (pgpEncType === ENC_TYPE_V2 || pgpEncType === ENC_TYPE_V3 || pgpEncType === ENC_TYPE_V4) {
        publicKeyArmored = JSON.parse(groupUpdater.publicKey).key
      } else {
        publicKeyArmored = groupUpdater.publicKey
      }

      if (!publicKeyArmored || !groupUpdater.encryptedPrivateKey) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.EncryptionKeysMissing,
          'Missing encryption keys',
          "Group updater doesn't have encryption keys"
        )
      }

      // Create an EncryptionKeys object from the UserV2 object.
      const encryptionKeys = {
        publicKeyArmored: publicKeyArmored,
        encryptedPrivateKey: groupUpdater.encryptedPrivateKey
      }

      let groupMembers = groupChat.combinedDID.split('_').sort()
      const groupAdmins = groupChat.admins.split('_').sort()

      // Get the current and updated members and admins
      const currentMembers = groupMembers
      const currentAdmins = groupAdmins
      const updateMembers = updateGroup.members
      const updateAdmins = updateGroup.admins

      // Find new members and admins which are present in updateGroup but not in groupChat
      const newMembers = [...updateMembers].filter((x) => !currentMembers.includes(x))
      const newAdmins = [...updateAdmins].filter((x) => !currentAdmins.includes(x))

      // Combine new members and admins into one set
      const newMembersAndAdmins = new Set([...newMembers, ...newAdmins])

      // Find removed members and admins which are present in groupChat but not in updateGroup
      const removedMembers = [...currentMembers].filter((x) => !updateMembers.includes(x))
      const removedAdmins = [...currentAdmins].filter((x) => !updateAdmins.includes(x))

      // Combine removed members and admins into one set
      const removedMembersAndAdmins = new Set([...removedMembers, ...removedAdmins])

      if (removedMembersAndAdmins.has(groupChat.intentSentBy)) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.GroupCreatorRemovalError,
          'Group creator removal error',
          'Group creator cannot be removed.'
        )
      }

      // Loop over each unique new member/admin
      for (const memberOrAdmin of newMembersAndAdmins) {
        const user = await w2wRepository.getUserV2(memberOrAdmin)

        // If the user doesn't exist, continue to the next iteration
        if (!user) continue

        // Use the checkBlockStatus function to check if either user has blocked the other
        const blockStatus = await checkBlockStatus(groupUpdater, user)
        if (!blockStatus.success) {
          return res.status(400).json(blockStatus.error)
        }
      }

      // Loop over each unique new member/admin
      for (const memberOrAdmin of newMembersAndAdmins) {
        if (updateGroup.rules && updateGroup.rules.entry) {
          // Evaluate the rules for the member or admin
          const rulesResult = await evaluateRules(
            updateGroup.chatId,
            updateGroup.rules,
            memberOrAdmin
          )

          // If entry is false, return an error
          if (!rulesResult.entry) {
            throw new ValidationError(
              HttpStatus.Forbidden,
              CommonErrors.GroupRulesAccessDenied,
              'Access denied by group rules',
              `Access denied for address ${memberOrAdmin} according to group rules`
            )
          }
        }
      }

      // For token gated groups, any token holder can auto join a group by clicking the "join" button
      // For auto-join, the address must not be a group member already, if it is then the address has already a pending intent, then it should approve the intent to become part of the group, no need to auto-join
      // For autojoin, only the only change in members and admins array should be the user address

      // TODO: Incase in future if there is request for autoJoin non token gated public groups, the user should join only as member but not admin, unlike token gated groups
      let autoJoinTokenGatedGroup = false
      let autoJoinGroup = false
      let hasGroupMetaChange = true

      if (
        groupChat.groupName === updateGroup.groupName &&
        groupChat.groupDescription === updateGroup.groupDescription &&
        groupChat.groupImage === updateGroup.groupImage &&
        groupChat.scheduleAt === updateGroup.scheduleAt &&
        groupChat.scheduleEnd === updateGroup.scheduleEnd &&
        groupChat.status === updateGroup.status &&
        ChatService.rulesAreEqual(groupChat.rules, updateGroup.rules) &&
        ChatService.metaAreEqual(groupChat.meta, updateGroup.meta)
      ) {
        hasGroupMetaChange = false
      }

      if (groupChat.contractAddressERC20 || groupChat.contractAddressNFT) {
        const updateGroupMembers = [...updateGroup.members]
        const updateGroupAdmins = [...updateGroup.admins]
        const indexMember = updateGroup.members.indexOf(updateGroup.address)
        const indexAdmins = updateGroup.admins.indexOf(updateGroup.address)
        if (indexMember > -1 && indexAdmins > -1) {
          updateGroupMembers.splice(indexMember, 1)
          updateGroupAdmins.splice(indexAdmins, 1)
          if (
            arraysEqual(groupMembers, updateGroupMembers) &&
            arraysEqual(groupAdmins, updateGroupAdmins) &&
            !hasGroupMetaChange
          ) {
            autoJoinTokenGatedGroup = true
          }
        }
      } else {
        const updateGroupMembers = [...updateGroup.members]
        const indexMember = updateGroup.members.indexOf(updateGroup.address)
        if (indexMember > -1) {
          updateGroupMembers.splice(indexMember, 1)
          if (
            arraysEqual(groupMembers, updateGroupMembers) &&
            arraysEqual(groupAdmins, updateGroup.admins) &&
            !hasGroupMetaChange
          ) {
            autoJoinGroup = true
          }
        }
      }

      if (autoJoinGroup && groupChat.sessionKey && !updateGroup.encryptedSecret) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.EncryptedSecretRequiredForAutoJoin,
          'Encrypted secret required for auto join',
          'Encrypted secret are required for private groups'
        )
      }

      groupMembers = groupChat.combinedDID.split('_').sort()
      let autoLeaveGroup = false
      const updateGroupMembers = [...updateGroup.members]
      const previousIndexMember = groupMembers.indexOf(updateGroup.address)

      if (previousIndexMember > -1) {
        groupMembers.splice(previousIndexMember, 1)
        if (
          arraysEqual(groupMembers, updateGroupMembers) &&
          arraysEqual(groupAdmins, updateGroup.admins) &&
          !hasGroupMetaChange
        ) {
          autoLeaveGroup = true
        }
      }

      // Resetting this value
      groupMembers = groupChat.combinedDID.split('_').sort()

      if (autoJoinTokenGatedGroup || autoJoinGroup) {
        if (groupChat.intent.includes(updateGroup.address)) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.AlreadyMemberError,
            'Already a member error',
            'You are already a member of the group'
          )
        }
        if (
          groupChat.combinedDID.includes(updateGroup.address) &&
          !groupChat.intent.includes(updateGroup.address)
        ) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.PendingJoinRequestError,
            'Pending join request error',
            'You have a pending request for joining this group'
          )
        }
      } else if (!autoLeaveGroup) {
        // Check if admin address has approved the intent. Someone can be in the admins column in the database but have their intent still not approved
        if (!groupChat.admins.includes(updateGroup.address))
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.NotGroupAdminError,
            'Not a group admin error',
            `Address ${updateGroup.address} is not a group admin`
          )
        if (!groupChat.intent.includes(updateGroup.address))
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.UnapprovedJoinRequestError,
            'Unapproved join request error',
            `Address ${updateGroup.address} hasn't approved the request`
          )
      }

      const membersPromise: Promise<{ success: boolean; err: string; address: string }>[] = []
      const adminsPromise: Promise<{ success: boolean; err: string; address: string }>[] = []
      if (updateGroup.members) {
        for (const address of updateGroup.members) {
          if (!isValidCAIP10Address(address))
            return res.status(400).json(`Invalid ${address} format`)
          // TODO: This was added for gitcoin
          // One corner case we facing is the group creator wont be a donor
          // So whenever we are checking for hasNecessaryTokensForTokenGatedGroup, it fails for creator
          if (address != groupChat.intentSentBy) {
            // We only validate token requirements for newly joined addresses
            if (!groupChat.combinedDID.includes(address)) {
              membersPromise.push(hasNecessaryTokensForTokenGatedGroup(address))
            }
          }
        }
      }
      if (updateGroup.admins) {
        for (const admin of updateGroup.admins) {
          if (!isValidCAIP10Address(admin)) return res.status(400).json(`Invalid ${admin} format`)
          // Every address in admins array should be in the members array as well
          if (!updateGroup.members.includes(admin))
            return res.status(400).json(`Address ${admin} is not present in members array`)

          // TODO: This was added for gitcoin
          // One corner case we facing is the group creator wont be a donor
          // So whenever we are checking for hasNecessaryTokensForTokenGatedGroup , it fails for creator
          if (admin != groupChat.intentSentBy) {
            // We only validate token requirements for newly joined addresses
            if (!groupChat.combinedDID.includes(admin)) {
              adminsPromise.push(hasNecessaryTokensForTokenGatedGroup(admin))
            }
          }
        }
      }
      const resultMembersHasTokens = await Promise.all(membersPromise)
      const resultAdminsHasTokens = await Promise.all(adminsPromise)
      for (const memberHasToken of resultMembersHasTokens) {
        if (!memberHasToken.success) return res.status(400).json(memberHasToken.err)
      }
      for (const adminHasToken of resultAdminsHasTokens) {
        if (!adminHasToken.success) return res.status(400).json(adminHasToken.err)
      }
      const [updateGroupSigType, updateGroupSignature] = updateGroup.verificationProof.split(':')
      if (updateGroupSigType !== 'pgp') return res.status(400).json('Invalid sigType')
      if (!updateGroupSignature) return res.status(400).json('Empty signature')

      let bodyToBeHashed: Omit<
        UpdateGroup & { chatId: string },
        'verificationProof' | 'address' | 'status'
      >
      if (updateGroupSigType === 'pgp') {
        bodyToBeHashed = {
          groupName: updateGroup.groupName,
          groupDescription: updateGroup.groupDescription,
          groupImage: updateGroup.groupImage,
          members: updateGroup.members,
          admins: updateGroup.admins,
          chatId: updateGroup.chatId
        }
      } else throw new Error(`Invalid sigType ${updateGroupSigType}`)

      const hash = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
      const isSignatureValid = await verifySignature({
        messageContent: hash,
        signatureArmored: updateGroupSignature,
        publicKeyArmored: encryptionKeys.publicKeyArmored
      })
      if (!isSignatureValid) {
        return { success: false, error: 'Invalid signature' }
      }

      // When removing an address from a group, if the address had an intent approved, then we should also remove the address from the intent
      const membersArray = groupChat.combinedDID.split('_')
      let intentArray = groupChat.intent.split('+')
      if (autoJoinTokenGatedGroup || autoJoinGroup) {
        intentArray.push(updateGroup.address)
        intentArray = intentArray.sort()
      } else {
        for (const address of membersArray) {
          // This means this address will be removed from the group
          if (!updateGroup.members.includes(address)) {
            // Remove from intents array
            // https://stackoverflow.com/a/44390963/11186795
            intentArray = intentArray.filter((x) => x !== address)
          }
        }
        intentArray = intentArray.sort()
      }

      if (updateGroup.groupImage) {
        const messageSizeInBytes = getSizeInBytes(updateGroup.groupImage)
        if (messageSizeInBytes / (1024 * 1024) > 2)
          return res.status(400).json('Group image too big')
      }
      if (updateGroup.groupName) {
        if (updateGroup.groupName === '') return res.status(400).json('Invalid Group Image')
        //if (updateGroup.groupName === groupChat.groupName) return res.status(400).json('Same group name')
        groupChat.groupName = updateGroup.groupName
      }
      groupChat.groupDescription = updateGroup.groupDescription
      if (updateGroup.members) groupChat.combinedDID = updateGroup.members.join('_')
      if (updateGroup.admins) groupChat.admins = updateGroup.admins.join('_')

      await w2wRepository.updateGroupMembers({
        members: groupChat.combinedDID,
        admins: groupChat.admins,
        intent: intentArray.join('+'),
        chatId: updateGroup.chatId,
        groupName: groupChat.groupName,
        groupDescription: groupChat.groupDescription,
        groupImage: updateGroup.groupImage,
        verificationProof: updateGroup.verificationProof,
        meta: updateGroup.meta === undefined ? groupChat.meta : updateGroup.meta,
        scheduleAt: updateGroup.scheduleAt,
        scheduleEnd: updateGroup.scheduleEnd,
        status: updateGroup.status ? updateGroup.status : groupChat.status
      })

      await w2wRepository.populateChatMembersForChat(
        updateGroup.chatId,
        groupChat.combinedDID,
        groupChat.admins,
        intentArray.join('+')
      )

      if (updateGroup.encryptedSecret) {
        const sessionKey = CryptoJs.SHA256(updateGroup.verificationProof).toString()
        await w2wRepository.insertSessionKey({
          sessionKey: sessionKey,
          encryptedSecret: updateGroup.encryptedSecret
        })
        await w2wRepository.updateGroupSessionKey(updateGroup.chatId, sessionKey)
      }
      const group = await getGroupDTO(updateGroup.chatId)

      if (hasGroupMetaChange) {
        if (group.groupType === GroupType.SPACES) {
          const space = convertGroupToSpace(group)
          let eventType: string
          let spaceNotificationEvent: PUSH_CHAT_NOTIFICATION

          if (groupChat.status !== updateGroup.status) {
            switch (updateGroup.status) {
              case ChatStatus.ACTIVE: {
                eventType = SpaceEventType.start
                spaceNotificationEvent = PUSH_CHAT_NOTIFICATION.START_SPACE
                break
              }
              case ChatStatus.ENDED: {
                eventType = SpaceEventType.stop
                spaceNotificationEvent = PUSH_CHAT_NOTIFICATION.END_SPACE
                break
              }
              default: {
                eventType = SpaceEventType.update
                spaceNotificationEvent = PUSH_CHAT_NOTIFICATION.UPDATE_SPACE
              }
            }
          } else if (groupChat.groupName !== updateGroup.groupName) {
            eventType = SpaceEventType.update
            spaceNotificationEvent = PUSH_CHAT_NOTIFICATION.UPDATE_SPACE
          }
          sendSpaceSocketEvent(groupChat.combinedDID, space, eventType, updateGroup.address)
          if (groupChat.status === ChatStatus.PENDING && updateGroup.status === ChatStatus.ACTIVE) {
            //sending internal space notification
            this.sendSpaceNotification(space, spaceNotificationEvent)
          }
        } else {
          sendGroupSocketEvent(
            groupChat.combinedDID,
            group,
            GroupEventType.update,
            updateGroup.address
          )
        }
      }

      if (autoJoinTokenGatedGroup || autoJoinGroup) {
        const payload = {
          chatId: group.chatId,
          from: updateGroup.address,
          to: [group.chatId],
          verificationProof: group.verificationProof
        }

        sendGroupSocketEvent(
          groupChat.combinedDID,
          payload,
          GroupEventType.joinGroup,
          updateGroup.address
        )
      }

      if (!autoJoinTokenGatedGroup && !autoJoinGroup) {
        if (newMembersAndAdmins && newMembersAndAdmins.size > 0) {
          const payload = {
            chatId: group.chatId,
            from: updateGroup.address,
            to: Array.from(newMembersAndAdmins),
            verificationProof: group.verificationProof
          }

          sendGroupSocketEvent(
            groupChat.combinedDID,
            payload,
            GroupEventType.request,
            updateGroup.address
          )
        }
      }
      if (autoLeaveGroup) {
        const payload = {
          chatId: group.chatId,
          from: updateGroup.address,
          to: [group.chatId],
          verificationProof: group.verificationProof
        }

        sendGroupSocketEvent(
          groupChat.combinedDID,
          payload,
          GroupEventType.leaveGroup,
          updateGroup.address
        )
      }

      if (!autoLeaveGroup) {
        if (removedMembersAndAdmins && removedMembersAndAdmins.size > 0) {
          const membersArray = Array.from(removedMembersAndAdmins)
          const combinedId = groupChat.combinedDID + '_' + membersArray.join('_')

          const payload = {
            chatId: group.chatId,
            from: updateGroup.address,
            to: membersArray,
            verificationProof: group.verificationProof
          }

          sendGroupSocketEvent(combinedId, payload, GroupEventType.remove, updateGroup.address)
        }
      }

      handleEmptyUsers(group)
      return res.status(200).send(group)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      return next(err)
    }
  }

  /**
   * CREATE GROUP V2
   * @dev - Creates a Group of type 'v2' which has idempotent and profile verification proof
   */
  public async createGroupV2(req: Request, res: Response, next: NextFunction) {
    try {
      const logger: Logger = Container.get('logger')

      const groupChat: CreateGroupV2 = {
        /******************* PROFILE VERIFICATION PROOF PARAMS ********************/
        groupName: req.body.groupName,
        groupDescription: req.body.groupDescription,
        groupImage: req.body.groupImage,
        rules: req.body.rules,
        isPublic: req.body.isPublic == 1 ? true : false,
        groupType: req.body.groupType,
        profileVerificationProof: req.body.profileVerificationProof,
        /******************* CONFIG VERIFICATION PROOF PARAMS ********************/
        config: {
          meta: req.body.config.meta,
          scheduleAt: req.body.config.scheduleAt,
          scheduleEnd: req.body.config.scheduleEnd,
          status: req.body.config.status,
          configVerificationProof: req.body.config.configVerificationProof
        },
        /****************** IDEMPOTENT VERIFICATION PROOF PARAMS *****************/
        members: req.body.members,
        admins: req.body.admins,
        idempotentVerificationProof: req.body.idempotentVerificationProof
      }
      /******************************* PARAM VALIDATIONS **************************************/
      await this.createGroupParamValidation(groupChat)
      /***************************************************************************************/
      /************************** VERIFY VERIFICATION PROOF **********************************/
      await this.verifyGroupIdempotentVerificationProof(groupChat)
      await this.verifyGroupProfileVerificationProof(groupChat)
      await this.verifyGroupConfigVerificationProof(groupChat.config)
      /****************************************************************************************/
      /*************************************** UPDATE DB **************************************/
      const groupCreatorDID = groupChat.idempotentVerificationProof.split(':').slice(2).join(':')
      let combinedDID = groupCreatorDID
      let admins = groupCreatorDID
      if (groupChat.members.length !== 0) combinedDID += '_' + groupChat.members.join('_')
      if (groupChat.admins.length !== 0) combinedDID += '_' + groupChat.admins.join('_')
      if (groupChat.admins.length !== 0) admins += '_' + groupChat.admins.join('_')
      // sort combinedDID
      combinedDID = combinedDID.split('_').sort().join('_')
      let chatId = CryptoJs.SHA256(
        JSON.stringify({
          groupName: groupChat.groupName,
          members: groupChat.members,
          admins: groupChat.admins,
          timestamp: Date.now()
        })
      ).toString()
      if (groupChat.groupType === 'spaces') {
        chatId = `spaces:${chatId}`
      }
      const chat: Chat = {
        combinedDID,
        chatId: chatId,
        intentSentBy: groupCreatorDID,
        intent: groupCreatorDID,
        threadhash: null,
        admins: admins,
        verificationProof: groupChat.idempotentVerificationProof,

        groupName: groupChat.groupName,
        groupDescription: groupChat.groupDescription,
        groupImage: groupChat.groupImage,
        rules: groupChat.rules,
        isPublic: groupChat.isPublic,
        groupType: groupChat.groupType,
        profileVerificationProof: groupChat.profileVerificationProof,

        meta: groupChat.config.meta,
        scheduleAt: groupChat.config.scheduleAt,
        scheduleEnd: groupChat.config.scheduleEnd,
        status: groupChat.config.status,
        configVerificationProof: groupChat.config.configVerificationProof,

        groupVersion: 'v2',
        /**
         * @deprecated
         */
        contractAddressNFT: null,
        numberOfNFTs: 0,
        contractAddressERC20: null,
        numberOfERC20: 0
      }
      await w2wRepository.createGroup(chat)
      await w2wRepository.populateChatMembersByChatId(chatId)
      logger.info(`Created group with chatId: ${chat.chatId}`)
      const group = await getGroupInfoDTO(chat.chatId)

      const membersAndAdmins = new Set([...groupChat.members, ...groupChat.admins])
      handleEmptyUsersV2([...membersAndAdmins])
      /***************************************************************************************/
      /************************** SEND NOTIF & SOCKET EVENTS *********************************/
      const bodyToBeHashed = {
        members: groupChat.members,
        admins: groupChat.admins
      }
      if (group.groupType === GroupType.SPACES) {
        const space = convertGroupToSpace(group as any)
        this.sendSpaceNotification(
          space,
          PUSH_CHAT_NOTIFICATION.CREATE_SPACE,
          bodyToBeHashed,
          groupChat.idempotentVerificationProof
        )
        sendSpaceSocketEventV2(space, SpaceEventType.create, groupCreatorDID)
      } else {
        // Send Push Notification
        const signedHash = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
        this.sendNotification(
          PUSH_CHAT_NOTIFICATION.CREATE_GROUP,
          groupCreatorDID,
          chatId,
          groupChat.idempotentVerificationProof.split(':')[1],
          signedHash
        )
        sendGroupSocketEventV2(group, GroupEventType.create, groupCreatorDID)
      }
      /***************************************************************************************/
      return res.status(200).send(group)
    } catch (err) {
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * GROUP CREATE GROUP V2 PARAM VALIDATION HELPER
   */
  private async createGroupParamValidation(groupChat: CreateGroupV2) {
    // 1. Verify All Group Profile Params
    await this.groupProfileParamValidation(groupChat)

    // 2. Verification Proof structure validation
    if (
      groupChat.idempotentVerificationProof.split(':').length < 3 ||
      groupChat.idempotentVerificationProof.split(':')[0] !== 'pgpv2'
    ) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.InvalidIdempotentVerificationProof,
        'Invalid idempotent verification proof',
        'Idempotent verification proof does not meet the required structure.'
      )
    }

    if (
      groupChat.config.configVerificationProof.split(':').length < 3 ||
      groupChat.config.configVerificationProof.split(':')[0] !== 'pgpv2'
    ) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.InvalidConfigVerificationProof,
        'Invalid config verification proof',
        'Config verification proof does not meet the required structure.'
      )
    }

    // 3. Schedule validation - Check start and end schedule (  only avalilable for spaces )
    const now = new Date()

    if (groupChat.config.scheduleAt) {
      const startDate = new Date(groupChat.config.scheduleAt)
      if (startDate < now) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidScheduleStartTime,
          'Invalid schedule start time',
          'Schedule start time must be in the future.'
        )
      }
    }

    if (groupChat.config.scheduleEnd) {
      const endDate = new Date(groupChat.config.scheduleEnd)
      const startDate = new Date(groupChat.config.scheduleAt)
      if (endDate < now) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidScheduleEndTime,
          'Invalid schedule end time',
          'Schedule end time must be in the future.'
        )
      }
      if (startDate >= endDate) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidScheduleTimeRange,
          'Invalid schedule time range',
          'Schedule start time must be earlier than end time.'
        )
      }
    }

    if (
      groupChat.groupType === GroupType.SPACES &&
      (!groupChat.config.scheduleAt || !groupChat.config.scheduleEnd)
    ) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.MissingScheduledTimeForSpaces,
        'Missing scheduled time',
        'Scheduled time is required for spaces.'
      )
    }

    // 4. Group Status validation
    if (groupChat.config.status) {
      if (groupChat.groupType !== GroupType.SPACES) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.StatusUpdateNotAllowed,
          'Status can only be updated for spaces',
          'Attempting to update status for a group type that is not a space.'
        )
      }
    } else if (!groupChat.config.status && groupChat.groupType === GroupType.SPACES) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.MissingStatusForSpaces,
        'Status required for spaces',
        'A status is required for space type groups.'
      )
    }

    // 5. Max group members Validation
    if (groupChat.isPublic) {
      if (groupChat.members.length > MAX_GROUP_MEMBERS_PUBLIC) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.MaxGroupMembersExceededPublic,
          'Group chat members limit exceeded',
          `Group chat members should be lower than ${MAX_GROUP_MEMBERS_PUBLIC} for public groups.`
        )
      }
      if (groupChat.admins.length > MAX_GROUP_MEMBERS_PUBLIC) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.MaxGroupAdminsExceededPublic,
          'Group chat admins limit exceeded',
          `Group chat admins should be lower than ${MAX_GROUP_MEMBERS_PUBLIC} for public groups.`
        )
      }
    } else {
      if (groupChat.members.length > NEW_MAX_GROUP_MEMBERS_PRIVATE) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.MaxGroupMembersExceededPrivate,
          'Group chat members limit exceeded',
          `Group chat members should be lower than ${NEW_MAX_GROUP_MEMBERS_PRIVATE} for private groups.`
        )
      }
      if (groupChat.admins.length > NEW_MAX_GROUP_MEMBERS_PRIVATE) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.MaxGroupAdminsExceededPrivate,
          'Group chat admins limit exceeded',
          `Group chat admins should be lower than ${NEW_MAX_GROUP_MEMBERS_PRIVATE} for private groups.`
        )
      }
    }

    // 6. Admins and Members Validation
    const setAdmins = new Set(groupChat.admins)
    const setMembers = new Set(groupChat.members)
    if (
      setAdmins.size !== groupChat.admins.length ||
      setMembers.size !== groupChat.members.length
    ) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.DuplicatedAdminOrMember,
        'Duplicated item in array of admins or members',
        'Each admin and member should have a unique address.'
      )
    }
    for (const address of groupChat.admins) {
      // When adding an admin, the address will automatically become a member
      if (groupChat.members.includes(address))
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.AdminAddressInMembersArray,
          'Admin address in members array',
          `Admin address ${address} is present on members array. Admins should not be listed as members.`
        )
    }

    const groupCreatorDID = groupChat.idempotentVerificationProof.split(':').slice(2).join(':')

    // 7. Max Groups/Spaces Created Validation
    let totalGroupsCreated
    if (groupChat.groupType === GroupType.SPACES) {
      totalGroupsCreated = await w2wRepository.getCountSpaces({
        did: groupCreatorDID
      })
    } else {
      totalGroupsCreated = await w2wRepository.getCountGroupChats({
        did: groupCreatorDID
      })
    }
    const maxGroups =
      groupChat.groupType === GroupType.SPACES ? MAX_SPACES_CAN_CREATE : MAX_GROUPS_CAN_CREATE
    if (totalGroupsCreated >= maxGroups) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.MaxGroupsLimitExceeded,
        'Max groups limit exceeded',
        `Address can only create up to ${maxGroups} ${
          groupChat.groupType === GroupType.SPACES ? 'spaces' : 'groups'
        }`
      )
    }

    // 8. Group Creator Validation
    // Note:- Group Creator is taken as admin by default

    // Group Creator in Members Array Validation
    if (groupChat.members.includes(groupCreatorDID)) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.GroupCreatorInMembers,
        'Group Creator in Members Array',
        'Group Creator address should not be on members array'
      )
    }

    // Group Creator in Admins Array Validation
    if (groupChat.admins.includes(groupCreatorDID)) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.GroupCreatorInAdmins,
        'Group Creator in Admins Array',
        'Group Creator address should not be on admins array'
      )
    }

    // Group Creator Profile Presence Validation
    const groupCreator = await w2wRepository.getUserV2(groupCreatorDID)
    if (!groupCreator) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.GroupCreatorNotPresent,
        'Group Creator Not Present',
        'Group creator profile is not present'
      )
    }

    // Create a Set with members and admins
    const membersAndAdmins = new Set([...groupChat.members, ...groupChat.admins])

    // 9. Check Block Status
    // Loop over each unique member/admin
    for (const memberOrAdmin of membersAndAdmins) {
      const user = await w2wRepository.getUserV2(memberOrAdmin)
      // If the user doesn't exist, continue to the next iteration
      if (!user) continue
      // Use the checkBlockStatus function to check if either user has blocked the other
      const blockStatus = await checkBlockStatus(groupCreator, user)
      if (!blockStatus.success) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.UserBlocked,
          'User Blocked',
          blockStatus.error
        )
      }
    }

    // 10. Check Entry and Chat Rules
    // Loop over each unique new member/admin
    for (const memberOrAdmin of membersAndAdmins) {
      // Skip the check if the member is the group creator
      if (memberOrAdmin === groupCreatorDID) {
        continue
      }
      if (groupChat.rules && groupChat.rules.entry) {
        // Evaluate the rules for the member or admin
        const rulesResult = await evaluateRules(null, groupChat.rules, memberOrAdmin)

        // If entry is false, return an error
        if (!rulesResult.entry) {
          throw new ValidationError(
            HttpStatus.BadRequest,
            CommonErrors.AccessDeniedByGroupRules,
            'Access Denied by Group Rules',
            `Access denied for address ${memberOrAdmin} according to group rules.`
          )
        }
      }
    }
  }

  /**
   * VERIFY GROUP IDEMPOTENT VERIFICATION PROOF HELPER
   */
  private async verifyGroupIdempotentVerificationProof(groupIdempotent: GroupIdempotent) {
    const { members, admins, idempotentVerificationProof } = groupIdempotent

    // 1. Verify User Existance and get keys
    const groupUpdaterDID = idempotentVerificationProof.split(':').slice(2).join(':')
    const groupUpdater = await w2wRepository.getUserV2(groupUpdaterDID)
    if (!groupUpdater || !groupUpdater.publicKey || groupUpdater.publicKey === '') {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.GroupUpdaterProfileNotPresent,
        'Group updater profile is not present',
        'The profile for the group updater is missing or incomplete.'
      )
    }
    const publicKeyArmored = w2wRepository.parseUserPublicKey(
      groupUpdater.encryptedPrivateKey,
      groupUpdater.publicKey
    )

    // 2.  Build Signed Body According to SigType
    const [sigType, signature] = idempotentVerificationProof.split(':')
    let bodyToBeHashed: Object
    switch (sigType) {
      case 'pgpv2': {
        bodyToBeHashed = {
          members,
          admins
        }
        break
      }
      default: {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidIdempotentVerificationSigType,
          'Invalid Idempotent Verification Proof SigType',
          'The signature type provided in the idempotent verification proof is invalid.'
        )
      }
    }

    // 3. Verify Signature
    const signedHash = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
    const isSignatureValid = await verifySignature({
      messageContent: signedHash,
      signatureArmored: signature,
      publicKeyArmored: publicKeyArmored
    })
    if (!isSignatureValid) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.InvalidIdempotentVerificationSigType,
        'Invalid Idempotent Verification Proof SigType',
        'The signature type provided in the idempotent verification proof is invalid.'
      )
    }
  }

  /**
   * UPDATE GROUP PROFILE
   * @dev - Requires `profile_verification_proof` for validation of changes. Structure `pgpv2:sig:updatorDID` where updatorDID should be present in the admins array
   */
  public async updateGroupProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const groupChat: GroupInfoDTO = await getGroupInfoDTO(req.params.chatId)
      const groupProfile: GroupProfile = {
        chatId: req.params.chatId,
        groupName: req.body.groupName,
        groupDescription: req.body.groupDescription,
        groupImage: req.body.groupImage,
        rules: req.body.rules,
        isPublic: (groupChat.isPublic as any) == 1 ? true : false, // Not Allowed to be updated currently
        groupType: groupChat.groupType, // Not Allowed to be updated currently
        profileVerificationProof: req.body.profileVerificationProof
      }
      /******************************* PARAM VALIDATIONS ***********************************/
      await this.groupProfileParamValidation(groupProfile)
      /*************************************************************************************/
      /************************* AUTHORIZATION VALIDATIONS *********************************/
      const groupUpdaterDID = groupProfile.profileVerificationProof.split(':').slice(2).join(':')
      const isGroupUpdatorAdmin = await w2wRepository.isAddressAdminWithIntentInGroup(
        groupProfile.chatId,
        groupUpdaterDID
      )
      if (!isGroupUpdatorAdmin) {
        throw new Error(`${groupUpdaterDID} is not a group admin`)
      }
      /*************************************************************************************/
      /***************************** VERIFY VERIFICATION PROOF *****************************/
      await this.verifyGroupProfileVerificationProof(groupProfile)
      /*************************************************************************************/
      /******************************** UPDATE DB ******************************************/
      await w2wRepository.updateGroupProfile(groupProfile)
      /*************************************************************************************/
      /************************ SEND NOTIF & SOCKET EVENTS *********************************/
      const updatedGroup = await getGroupInfoDTO(groupProfile.chatId)
      const { profileVerificationProof, ...bodyToBeHashed } = groupProfile
      if (groupChat.groupType === GroupType.SPACES) {
        const space = convertGroupToSpace(updatedGroup)
        const eventType: string = SpaceEventType.update
        sendSpaceSocketEventV2(space, eventType, groupUpdaterDID)
      } else {
        sendGroupSocketEventV2(updatedGroup, GroupEventType.update, groupUpdaterDID)
      }
      /*************************************************************************************/
      return res.status(200).send(updatedGroup)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      return res.status(400).json(err.message)
    }
  }

  /**
   * GROUP PROFILE PARAM VALIDATION HELPER
   */
  private async groupProfileParamValidation(groupProfile: GroupProfile) {
    const { groupImage, rules, profileVerificationProof } = groupProfile

    // 1. Verification Proof structure validation
    if (
      profileVerificationProof.split(':').length < 3 ||
      profileVerificationProof.split(':')[0] !== 'pgpv2'
    ) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.InvalidProfileVerificationProof,
        'Invalid profile verification proof',
        'Profile verification proof does not meet the required structure.'
      )
    }

    // 2. Group Image Validation - Checks if the group image is not too big
    if (groupImage) {
      const messageSizeInBytes = getSizeInBytes(groupImage)
      if (messageSizeInBytes / (1024 * 1024) > 2) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidGroupName,
          'Group image too big',
          'The size of the group image exceeds the 2MB limit.'
        )
      }
    }

    // 3. Group Rules validation
    if (rules) {
      const ruleErrors = await validateRules(rules)
      if (ruleErrors.length > 0) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidGroupRules,
          'Rule validation failed',
          JSON.stringify({ errors: ruleErrors })
        )
      }
    }
  }

  /**
   * VERIFY GROUP PROFILE VERIFICATION PROOF HELPER
   */
  private async verifyGroupProfileVerificationProof(groupProfile: GroupProfile) {
    const {
      groupName,
      groupDescription,
      groupImage,
      rules,
      isPublic,
      groupType,
      profileVerificationProof
    } = groupProfile

    // 1. Verify User Existance and get keys
    const groupUpdaterDID = profileVerificationProof.split(':').slice(2).join(':')
    const groupUpdater = await w2wRepository.getUserV2(groupUpdaterDID)
    if (!groupUpdater || !groupUpdater.publicKey || groupUpdater.publicKey === '') {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.GroupUpdaterProfileNotPresent,
        'Group updater profile is not present',
        'The profile for the group updater is missing or incomplete.'
      )
    }
    const publicKeyArmored = w2wRepository.parseUserPublicKey(
      groupUpdater.encryptedPrivateKey,
      groupUpdater.publicKey
    )

    // 2.  Build Signed Body According to SigType
    const [sigType, signature] = profileVerificationProof.split(':')
    let bodyToBeHashed: Object
    switch (sigType) {
      case 'pgpv2': {
        bodyToBeHashed = {
          groupName,
          groupDescription,
          groupImage,
          rules,
          isPublic,
          groupType
        }
        break
      }
      default: {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidProfileVerificationSigType,
          'Invalid Profile Verification Proof SigType',
          'The signature type provided in the profile verification proof is invalid.'
        )
      }
    }
    // 3. Verify Signature
    const signedHash = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
    const isSignatureValid = await verifySignature({
      messageContent: signedHash,
      signatureArmored: signature,
      publicKeyArmored: publicKeyArmored
    })
    if (!isSignatureValid) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.InvalidProfileVerificationProof,
        'Invalid Profile Verification Proof',
        'The provided profile verification proof is invalid or tampered.'
      )
    }
  }

  /**
   * UPDATE GROUP CONFIG
   */
  public async updateGroupConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const group: GroupInfoDTO = await getGroupInfoDTO(req.params.chatId)
      const groupConfig: GroupConfig = {
        chatId: req.params.chatId,
        meta: req.body.meta,
        scheduleAt: req.body.scheduleAt,
        scheduleEnd: req.body.scheduleEnd,
        status: req.body.status,
        configVerificationProof: req.body.configVerificationProof
      }
      /******************************* PARAM VALIDATIONS **************************************/
      await this.groupConfigParamValidation(groupConfig)
      /****************************************************************************************/
      /*************************** AUTHORIZATION VALIDATIONS **********************************/
      const groupUpdaterDID = groupConfig.configVerificationProof.split(':').slice(2).join(':')
      const isGroupUpdatorAdmin = await w2wRepository.isAddressAdminWithIntentInGroup(
        groupConfig.chatId,
        groupUpdaterDID
      )
      if (!isGroupUpdatorAdmin) {
        throw new Error(`${groupUpdaterDID} is not a group admin`)
      }
      /****************************************************************************************/
      /***************************** VERIFY VERIFICATION PROOF ********************************/
      await this.verifyGroupConfigVerificationProof(groupConfig)
      /****************************************************************************************/
      /*********************************** UPDATE DB ******************************************/
      await w2wRepository.updateGroupConifg(groupConfig)
      /****************************************************************************************/
      /************************ SEND NOTIF & SOCKET EVENTS ************************************/
      const updatedGroup: GroupInfoDTO = await getGroupInfoDTO(groupConfig.chatId)
      const { configVerificationProof, ...bodyToBeHashed } = groupConfig

      if (group.groupType === GroupType.SPACES) {
        const space = convertGroupToSpace(updatedGroup)
        let eventType: string = SpaceEventType.update
        let spaceNotificationEvent: PUSH_CHAT_NOTIFICATION = PUSH_CHAT_NOTIFICATION.UPDATE_SPACE

        if (group.status !== groupConfig.status) {
          switch (groupConfig.status) {
            case ChatStatus.ACTIVE: {
              eventType = SpaceEventType.start
              spaceNotificationEvent = PUSH_CHAT_NOTIFICATION.START_SPACE
              break
            }
            case ChatStatus.ENDED: {
              eventType = SpaceEventType.stop
              spaceNotificationEvent = PUSH_CHAT_NOTIFICATION.END_SPACE
              break
            }
            default: {
              eventType = SpaceEventType.update
              spaceNotificationEvent = PUSH_CHAT_NOTIFICATION.UPDATE_SPACE
            }
          }
        }
        sendSpaceSocketEventV2(space, eventType, groupUpdaterDID)
        if (group.status === ChatStatus.PENDING && groupConfig.status === ChatStatus.ACTIVE) {
          //sending internal space notification
          this.sendSpaceNotification(
            space,
            spaceNotificationEvent,
            bodyToBeHashed,
            configVerificationProof
          )
        }
      } else {
        sendGroupSocketEventV2(updatedGroup, GroupEventType.update, groupUpdaterDID)
      }
      /*************************************************************************************/
      return res.status(200).send(updatedGroup)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', err)
      return res.status(400).json(err.message)
    }
  }

  /**
   * GROUP CONFIG PARAM VALIDATION HELPER
   */
  private async groupConfigParamValidation(groupConfig: GroupConfig) {
    const { configVerificationProof, chatId, meta, scheduleAt, scheduleEnd, status } = groupConfig

    // 1. Verification Proof structure validation
    if (
      configVerificationProof.split(':').length < 3 ||
      configVerificationProof.split(':')[0] !== 'pgpv2'
    ) {
      throw new Error('Invalid Config verification proof')
    }

    // 2. Chat validation - Checks if a valid group is present for the given chatId and address is an admin
    const groupChat: GroupInfoDTO = await getGroupInfoDTO(chatId)

    // 4. Schedule validation - Check start and end schedule (  only avalilable for spaces )
    const now = new Date()
    if (scheduleAt && scheduleAt !== groupChat.scheduleAt) {
      const startDate = new Date(scheduleAt)
      if (startDate < now && status === ChatStatus.PENDING) {
        throw new Error('Schedule start time must be in the future.')
      }
    }
    if (scheduleEnd && scheduleEnd !== groupChat.scheduleEnd) {
      const endDate = new Date(scheduleEnd)
      const startDate = new Date(scheduleAt)
      if (endDate < now) {
        throw new Error('Schedule end time must be in the future.')
      }
      if (startDate >= endDate) {
        throw new Error('Schedule start time must be earlier than end time.')
      }
    }
    if (groupChat.groupType === GroupType.SPACES && !scheduleAt) {
      throw new Error('Scheduled time is required for spaces')
    }

    // 5. Group Status validation
    if (status && status !== groupChat.status) {
      if (groupChat.groupType !== GroupType.SPACES) {
        throw new Error('Status can only be updated for spaces')
      }
      if (groupChat.status === ChatStatus.ENDED) {
        throw new Error(`No updates allowed on the space which is ended`)
      }
      if (status === ChatStatus.ACTIVE && groupChat.status === ChatStatus.PENDING) {
        const currentTime = new Date()
        const difference =
          (new Date(groupChat.scheduleAt).getTime() - currentTime.getTime()) / 1000 / 60 // in minutes
        if (difference > 15) {
          throw new Error(
            `Spaces can only start the stream up to 15 minutes before the scheduled time`
          )
        }
      }
    } else if (!status && groupChat.groupType === GroupType.SPACES) {
      throw new Error('Status required for spaces')
    }
  }

  /**
   * VERIFY GROUP CONFIG VERIFICATION PROOF HELPER
   */
  private async verifyGroupConfigVerificationProof(groupConifg: GroupConfig) {
    const { configVerificationProof, meta, scheduleAt, scheduleEnd, status } = groupConifg

    // 1. Verify User Existance and get keys
    const updaterDID = configVerificationProof.split(':').slice(2).join(':')
    const groupUpdater = await w2wRepository.getUserV2(updaterDID)
    if (!groupUpdater || !groupUpdater.publicKey || groupUpdater.publicKey === '') {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.GroupUpdaterProfileNotPresent,
        'Group updater profile is not present',
        'The profile for the group updater is missing or incomplete.'
      )
    }
    const publicKeyArmored = w2wRepository.parseUserPublicKey(
      groupUpdater.encryptedPrivateKey,
      groupUpdater.publicKey
    )

    // 2.  Build Signed Body According to SigType
    const [sigType, signature] = configVerificationProof.split(':')
    let bodyToBeHashed: Object
    switch (sigType) {
      case 'pgpv2': {
        bodyToBeHashed = {
          meta,
          scheduleAt,
          scheduleEnd,
          status
        }
        break
      }
      default: {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidConfigVerificationSigType,
          'Invalid Config Verification Proof SigType',
          'The signature type provided in the config verification proof is invalid.'
        )
      }
    }

    // 3. Verify Signature
    const signedHash = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
    const isSignatureValid = await verifySignature({
      messageContent: signedHash,
      signatureArmored: signature,
      publicKeyArmored: publicKeyArmored
    })
    if (!isSignatureValid) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.InvalidConfigVerificationProof,
        'Invalid Config Verification Proof',
        'The provided config verification proof is invalid or tampered.'
      )
    }
  }

  /**
   * UPDATE GROUP PARTICIPANTS
   * @dev - Updates the group members and admins
   * @dev - Requires `delta_verification_proof` for validation of changes. Structure `pgpv2:sig:updatorDID` where updatorDID should be present in the admins array or it just be just an autoJoin or autoLeave
   */
  public async updateGroupMembers(req: Request, res: Response): Promise<Response | void> {
    const chatId = req.params.chatId
    const { upsert, remove, deltaVerificationProof, encryptedSecret } = req.body as GroupDelta
    const adminsToUpsert = upsert.admins
    const membersToUpsert = upsert.members
    /******************************* PARAM VALIDATIONS **************************************/
    try {
      // 1. Group Existence Validation
      const group = await getGroupInfoDTO(chatId)
      if (!group) {
        return res.status(400).json(`No group with chatId ${chatId}`)
      }
      // 2. DID Format Validation
      const addressFormatError = validateAddressFormats(adminsToUpsert, membersToUpsert, remove)
      if (addressFormatError) {
        return res.status(400).json({ error: 'Validation error', details: addressFormatError })
      }
      // 3. Common Elements Validation
      const commonElementsError = validateCommonElements(adminsToUpsert, membersToUpsert, remove)
      if (commonElementsError) {
        return res.status(400).json({ error: 'Validation error', details: commonElementsError })
      }
      // 4. Invalid participant removal validation
      const invalidRemovalError = await validateMemberRemoval(chatId, remove)
      if (invalidRemovalError) {
        return res.status(400).json({ error: 'Validation error', details: invalidRemovalError })
      }
      // 5. Delta Verification Proof Structure Validation
      if (
        deltaVerificationProof.split(':').length < 3 ||
        deltaVerificationProof.split(':')[0] !== 'pgpv2'
      ) {
        return res.status(400).json('Invalid verification proof')
      }
      // 6. Group Updater Validation
      const signer = deltaVerificationProof.split(':').slice(2).join(':')
      const groupUpdater = await w2wRepository.getUserV2(signer)
      if (!groupUpdater) {
        return res.status(400).json('Group updater profile is not present')
      }
      // 7. AutoJoin and AutoLeave Validations
      const _isAutoJoin = await isAutoJoin(adminsToUpsert, membersToUpsert, remove, signer)
      const _isAutoLeave = await isAutoLeave(adminsToUpsert, membersToUpsert, remove, signer)
      // If it's not an AutoJoin or AutoLeave, the signer must be an admin
      if (!_isAutoJoin && !_isAutoLeave) {
        const isSignerAdmin = await w2wRepository.isAddressAdminWithIntentInGroup(chatId, signer)
        if (!isSignerAdmin) {
          return res.status(403).json({
            error: 'Permission denied',
            details: 'The signer must be an admin to update group members.'
          })
        }
      }
      // 8. Group Gating Validation
      const deniedAccessAdmins = await checkAccessRulesForNewMembers(
        chatId,
        group.rules,
        adminsToUpsert,
        { isAutoJoin: _isAutoJoin }
      )
      const deniedAccessMembers = await checkAccessRulesForNewMembers(
        chatId,
        group.rules,
        membersToUpsert,
        { isAutoJoin: _isAutoJoin }
      )
      if (deniedAccessAdmins.length > 0 || deniedAccessMembers.length > 0) {
        return res.status(403).json({
          error: 'Access denied',
          details: {
            admins: deniedAccessAdmins,
            members: deniedAccessMembers
          }
        })
      }
      // 9. Session Key Validation
      const removedParticipantsInfo = await w2wRepository.getMembersByAddresses(chatId, remove)
      let _isNewSessionKeyRequired = _isAutoJoin ? true : false
      removedParticipantsInfo.map((participant) => {
        if (participant.intent) {
          _isNewSessionKeyRequired = true
        }
      })
      if (!group.isPublic && _isNewSessionKeyRequired && group.sessionKey) {
        if (!encryptedSecret) {
          return res
            .status(400)
            .json('Session key and encrypted secret are required for private groups')
        }
      }
      /*************************************************************************************/
      /***************************** VERIFY VERIFICATION PROOF *****************************/
      // Determine the encryption type
      const pgpEncType = w2wRepository.getPgpEncType(groupUpdater.encryptedPrivateKey)
      // Parse the public key based on the encryption type
      let publicKeyArmored: string
      if (pgpEncType === ENC_TYPE_V2 || pgpEncType === ENC_TYPE_V3 || pgpEncType === ENC_TYPE_V4) {
        publicKeyArmored = JSON.parse(groupUpdater.publicKey).key
      } else {
        publicKeyArmored = groupUpdater.publicKey
      }

      if (!publicKeyArmored || !groupUpdater.encryptedPrivateKey) {
        return res.status(400).json("Group updater doesn't have encryption keys")
      }
      const bodyToBeHashed = {
        upsert,
        remove,
        encryptedSecret
      }
      const signedHash = CryptoJs.SHA256(JSON.stringify(bodyToBeHashed)).toString()
      const [sigType, signature] = deltaVerificationProof.split(':')

      const isSignatureValid = await verifySignature({
        messageContent: signedHash,
        signatureArmored: signature,
        publicKeyArmored: publicKeyArmored
      })
      if (!isSignatureValid) {
        return res.status(400).json('Invalid Verification Proof')
      }
      /*************************************************************************************/
      /******************************** UPDATE DB ******************************************/
      const memberUpdates = await w2wRepository.updateGroupMembersInDB(
        chatId,
        adminsToUpsert,
        membersToUpsert,
        remove,
        _isAutoJoin
      )
      await w2wRepository.insertGroupDeltaVerificationProof({
        chatId,
        signer,
        verificationProof: deltaVerificationProof,
        payload: JSON.stringify({ adminsToUpsert, membersToUpsert, remove })
      })

      const combinedDID = await w2wRepository.updateW2WTable(chatId)
      const allMembers = new Set([...adminsToUpsert, ...membersToUpsert])
      handleEmptyUsersV2([...allMembers])

      if (encryptedSecret) {
        const sessionKey = CryptoJs.SHA256(deltaVerificationProof).toString()
        await w2wRepository.insertSessionKey({
          sessionKey,
          encryptedSecret
        })
        await w2wRepository.updateGroupSessionKey(chatId, sessionKey)
      }
      /*************************************************************************************/
      /*************************** SEND NOTIFS AND EVENTS **********************************/
      if (_isAutoJoin) {
        if (group.groupType === 'spaces') {
          const payload = {
            spaceId: group.chatId,
            from: signer,
            to: [group.chatId],
            verificationProof: deltaVerificationProof
          }
          sendSpaceSocketEvent(combinedDID, payload, SpaceEventType.joinSpace, signer)
        } else {
          const payload = {
            chatId: group.chatId,
            from: signer,
            to: [group.chatId],
            verificationProof: deltaVerificationProof
          }
          sendGroupSocketEvent(combinedDID, payload, GroupEventType.joinGroup, signer)
        }
      }

      if (_isAutoLeave) {
        if (group.groupType === 'spaces') {
          const payload = {
            spaceId: group.chatId,
            from: signer,
            to: [group.chatId],
            verificationProof: deltaVerificationProof
          }
          sendSpaceSocketEvent(combinedDID, payload, SpaceEventType.leaveSpace, signer)
        } else {
          const payload = {
            chatId: group.chatId,
            from: signer,
            to: [group.chatId],
            verificationProof: deltaVerificationProof
          }
          sendGroupSocketEvent(combinedDID, payload, GroupEventType.leaveGroup, signer)
        }
      }

      if (!_isAutoJoin && !_isAutoLeave) {
        if (memberUpdates.add.admins.length > 0 || memberUpdates.add.members.length > 0) {
          const newMembersAndAdmins = new Set([
            ...memberUpdates.add.admins,
            ...memberUpdates.add.members
          ])
          if (group.groupType === 'spaces') {
            const payload = {
              spaceId: group.chatId,
              from: signer,
              to: Array.from(newMembersAndAdmins),
              verificationProof: deltaVerificationProof
            }
            sendSpaceSocketEvent(combinedDID, payload, SpaceEventType.request, signer)
          } else {
            const payload = {
              chatId: group.chatId,
              from: signer,
              to: Array.from(newMembersAndAdmins),
              verificationProof: deltaVerificationProof
            }
            sendGroupSocketEvent(combinedDID, payload, GroupEventType.request, signer)
          }
        }

        if (memberUpdates.remove.admins.length > 0 || memberUpdates.remove.members.length > 0) {
          const removedMembersAndAdmins = new Set([
            ...memberUpdates.remove.admins,
            ...memberUpdates.remove.members
          ])
          const membersArray = Array.from(removedMembersAndAdmins)

          const combinedId = combinedDID + '_' + membersArray.join('_')
          if (group.groupType === 'spaces') {
            const payload = {
              spaceId: group.chatId,
              from: signer,
              to: membersArray,
              verificationProof: deltaVerificationProof
            }
            sendSpaceSocketEvent(combinedDID, payload, SpaceEventType.remove, signer)
          } else {
            const payload = {
              chatId: group.chatId,
              from: signer,
              to: membersArray,
              verificationProof: deltaVerificationProof
            }
            sendGroupSocketEvent(combinedId, payload, GroupEventType.remove, signer)
          }
        }

        memberUpdates.change.forEach((change) => {
          if (group.groupType === 'spaces') {
            const payload = {
              spaceId: group.chatId,
              from: signer,
              to: [change.address],
              verificationProof: deltaVerificationProof,
              previousRole: change.previousRole,
              newRole: change.newRole
            }
            sendSpaceSocketEvent(combinedDID, payload, SpaceEventType.remove, signer)
          } else {
            const payload = {
              chatId: group.chatId,
              from: signer,
              to: [change.address],
              verificationProof: deltaVerificationProof,
              previousRole: change.previousRole,
              newRole: change.newRole
            }
            sendGroupSocketEvent(combinedDID, payload, GroupEventType.roleChange, signer)
          }
        })
      }
      /*************************************************************************************/
      const response = await getGroupInfoDTO(chatId)
      res.status(200).json(response)
    } catch (error) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', error)
      res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  }

  public async getGroupByChatId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const chatId = req.params.chatId
      const group = await getGroupDTO(chatId)
      if (!group) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.ChatNotFound,
          'No group found',
          `No group with chatId ${chatId}`
        )
      }
      return res.status(200).json(group)
    } catch (err) {
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  /**
   * GET GROUP INFO FROM CHAT ID
   */
  public async getGroupInfo(req: Request, res: Response): Promise<Response | void> {
    try {
      const chatId = req.params.chatId
      const group = await getGroupInfoDTO(chatId)
      if (!group) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.ChatNotFound,
          'No group found',
          `No group with chatId ${chatId}`
        )
      }
      return res.status(200).json(group)
    } catch (err) {
      if (err instanceof ValidationError) {
        const errorResponse = {
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        }
        return res.status(err.status).json(errorResponse)
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getGroupMembersPublicKeys(req: Request, res: Response): Promise<Response | void> {
    // Extract chatId, pageNumber, and pageSize from request params or query string
    const chatId: string = req.params.chatId
    const pageNumber: number = parseInt(req.query.pageNumber as string) || 1
    const pageSize: number = parseInt(req.query.pageSize as string) || 20

    // Validate inputs
    if (!chatId) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.InvalidAPIInput,
        'Invalid input',
        'Chat ID is required.'
      )
    }

    if (isNaN(pageNumber) || isNaN(pageSize) || pageNumber <= 0 || pageSize <= 0) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.InvalidAPIInput,
        'Invalid input',
        'Page number and page size must be positive integers and greater than zero.'
      )
    }

    try {
      const group = await getGroupInfoDTO(chatId)
      if (!group) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.ChatNotFound,
          'No group found',
          `No group with chatId ${chatId}`
        )
      }

      // Fetch paginated chat members with profile details
      const members: ChatMemberPublicKey[] = await w2wRepository.fetchChatMembersWithPublicKey(
        chatId,
        pageSize,
        pageNumber
      )

      // Send successful response with total member count and member profiles
      res.status(200).json({
        members
      })
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(err.status).json({
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        })
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getGroupMembers(req: Request, res: Response): Promise<Response | void> {
    // Extract chatId, pageNumber, and pageSize from request params or query string
    try {
      const chatId: string = req.params.chatId
      const pageNumber: number = parseInt(req.query.pageNumber as string) || 1
      const pageSize: number = parseInt(req.query.pageSize as string) || 20
      const role = req.query.role as string | undefined

      let pending: boolean | undefined
      const pendingQueryParam = req.query.pending as string | boolean

      if (pendingQueryParam === 'true' || pendingQueryParam === true) {
        pending = true
      } else if (pendingQueryParam === 'false' || pendingQueryParam === false) {
        pending = false
      } else {
        pending = undefined
      }

      // Validate inputs
      if (!chatId) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAPIInput,
          'Invalid input',
          'Chat ID is required.'
        )
      }

      if (isNaN(pageNumber) || isNaN(pageSize) || pageNumber <= 0 || pageSize <= 0) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAPIInput,
          'Invalid input',
          'Page number and page size must be positive integers and greater than zero.'
        )
      }

      const group = await getGroupInfoDTO(chatId)
      if (!group) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.ChatNotFound,
          'No group found',
          `No group with chatId ${chatId}`
        )
      }

      // Fetch paginated chat members with profile details
      const members: ChatMemberProfile[] = await w2wRepository.fetchChatMembersWithProfile(
        chatId,
        pageSize,
        pageNumber,
        pending,
        role
      )

      // Send successful response with total member count and member profiles
      res.status(200).json({
        members
      })
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(err.status).json({
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        })
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getGroupMemberCount(req: Request, res: Response): Promise<Response | void> {
    const chatId: string = req.params.chatId

    try {
      // Validate inputs
      if (!chatId) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAPIInput,
          'Invalid input',
          'Chat ID is required.'
        )
      }

      const group = await getGroupInfoDTO(chatId)
      if (!group) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.ChatNotFound,
          'No group found',
          `No group with chatId ${chatId}`
        )
      }
      // Fetch total member count
      const totalMembersCount: ChatMemberCounts = await w2wRepository.getGroupMemberCount(chatId)

      // Send successful response with total member count and member profiles
      res.status(200).json({
        totalMembersCount
      })
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(err.status).json({
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        })
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getGroupAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const chatId = req.params.chatId
      const did = req.params.did

      if (!chatId || !did) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAPIInput,
          'Invalid input',
          `chatId and did parameters are required.`
        )
      }

      if (!isValidCAIP10Address(did)) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAddress,
          'Invalid address',
          `${did} is invalid.`
        )
      }

      const group = await getGroupDTO(chatId)
      if (!group) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.ChatNotFound,
          'No group found',
          `No group with chatId ${chatId}.`
        )
      }

      if (group.rules) {
        const rulesResult = await evaluateRules(chatId, group.rules, did, true)
        return res.status(200).json(rulesResult)
      } else {
        return res.status(200).json({
          entry: true,
          chat: true
        })
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(err.status).json({
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        })
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getGroupMemberStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const chatId = req.params.chatId
      const did = req.params.did
      if (!chatId || !did) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAPIInput,
          'Invalid input',
          `chatId and did parameters are required.`
        )
      }

      if (!isValidCAIP10Address(did)) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.InvalidAddress,
          'Invalid address',
          `${did} is invalid.`
        )
      }

      const chat: Chat = await w2wRepository.getChatByChatId({ chatId })

      if (!chat) {
        throw new ValidationError(
          HttpStatus.BadRequest,
          CommonErrors.ChatNotFound,
          'No group found',
          `No group with chatId ${chatId}.`
        )
      }

      return res.status(200).json({
        isMember: chat.combinedDID.includes(did),
        isPending: !chat.intent.includes(did) && chat.combinedDID.includes(did),
        isAdmin: chat.admins.includes(did)
      })
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(err.status).json({
          status: err.status,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString()
        })
      }
      return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
    }
  }

  public async getChat(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const did = req.params.did
      if (!isValidCAIP10Address(did)) {
        return res.status(400).json(`${did} is invalid`)
      }
      const recipient = req.params.recipient
      const isGroup = !isValidCAIP10Address(recipient)
      let chat: Chat
      if (isGroup) {
        chat = await w2wRepository.getChat({
          combinedDID: null,
          isGroup: true,
          chatId: recipient
        })
      } else {
        const { combinedDID } = combinedWalletDID({
          firstDID: did,
          secondDID: recipient
        })
        chat = await w2wRepository.getChat({
          combinedDID,
          isGroup: false,
          chatId: null
        })
      }
      if (chat === null) return res.status(200).json({})
      let otherUser: UserV2 | null = null
      const groupInfo = isGroup ? await getLimitedGroupDTOHelper(chat) : null

      let limitedIntent: string = ''
      let limitedCombinedDID: string = ''
      if (isGroup) {
        groupInfo.members.map((member) => {
          limitedIntent = limitedIntent + member.wallet + '+'
          limitedCombinedDID = limitedCombinedDID + member.wallet + '_'
        })
        groupInfo.pendingMembers.map((member) => {
          limitedCombinedDID = limitedCombinedDID + member.wallet + '_'
        })
      } else {
        const chatMembers = await w2wRepository.fetchChatMembersWithProfile(chat.chatId, 2, 1)
        chatMembers.map((member) => {
          if (member.intent) {
            limitedIntent = limitedIntent + member.address + '+'
          }
          limitedCombinedDID = limitedCombinedDID + member.address + '_'
          if (member.address.toLowerCase() != did.toLowerCase()) {
            otherUser = member.userInfo
          }
        })
      }
      if (limitedIntent.length > 0) {
        limitedIntent = limitedIntent.slice(0, -1)
      }
      if (limitedCombinedDID.length > 0) {
        limitedCombinedDID = limitedCombinedDID.slice(0, -1)
      }
      const intent: string = limitedIntent
      const combinedDID: string = limitedCombinedDID

      let message: Message
      if (chat.threadhash !== null) {
        const reference = await getReferenceFromThreadhash(chat.threadhash)
        message = await getMessageByReference(reference)
      }
      // This is for groups that are created without any message
      else {
        message = {
          encType: 'PlainText',
          encryptedSecret: '',
          fromCAIP10: '',
          fromDID: '',
          link: '',
          messageContent: '',
          messageType: '',
          sigType: '',
          signature: '',
          toCAIP10: '',
          toDID: ''
        }
      }

      const inbox: ChatInbox = {
        chatId: chat.chatId,
        did: isGroup ? null : otherUser.did,
        wallets: isGroup ? null : otherUser.wallets,
        profilePicture: isGroup ? null : otherUser.profile.picture,
        publicKey: isGroup ? null : otherUser.publicKey,
        about: isGroup ? null : otherUser.profile.desc,
        name: isGroup ? null : otherUser.profile.name,
        threadhash: chat.threadhash == null || chat.threadhash.length == 0 ? null : chat.threadhash,
        intent: intent,
        intentSentBy: chat.intentSentBy,
        intentTimestamp: chat.intentTimestamp,
        combinedDID: combinedDID,
        groupInformation: groupInfo,
        msg: message
      }
      return res.status(200).json(inbox)
    } catch (e) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', e)
      return next(e)
    }
  }

  public async getSpace(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const did = req.params.did
      if (!isValidCAIP10Address(did)) {
        return res.status(400).json(`${did} is invalid`)
      }

      const recipient = req.params.recipient

      const chat = await w2wRepository.getChat({
        combinedDID: null,
        isGroup: true,
        chatId: recipient
      })
      if (chat === null) return res.status(200).json({})
      const groupInformation = await getGroupDTOHelper(chat)
      const spaceInformation = convertGroupToSpace(groupInformation)
      const inbox: SpaceInbox = {
        spaceId: chat.chatId,
        did: null,
        wallets: null,
        profilePicture: null,
        publicKey: null,
        about: null,
        name: null,
        threadhash: chat.threadhash == null || chat.threadhash.length == 0 ? null : chat.threadhash,
        intent: chat.intent,
        intentSentBy: chat.intentSentBy,
        intentTimestamp: chat.intentTimestamp,
        combinedDID: chat.combinedDID,
        spaceInformation
      }
      return res.status(200).json(inbox)
    } catch (e) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', e)
      return next(e)
    }
  }

  /**
   * @deprecated - use @getGroupProfile or @getGroupMembers instead
   */
  public async getGroup(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const groupName = req.query.groupName as string
      if (!groupName) return res.status(400).json('No group name')

      const chat: Chat = await w2wRepository.getChatByGroupName({ groupName })
      if (!chat) return res.status(400).json(`No group with group name ${groupName}`)

      const groupReturn = await getGroupDTOHelper(chat)

      return res.status(200).json(groupReturn)
    } catch (e) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', e)
      return next(e)
    }
  }

  /**
   * CRON JOB FUNCTION
   * Trigger Notification for Upcoming Spaces
   */
  public async batchProcessUpcomingSpaceNotifcation(): Promise<void> {
    const SPACE_START_LIMIT = 15 * 60 * 1000 // 15 Min in ms

    let page = 1
    const pageLimit = 30
    let filteredTrendingSpaces: SpaceInbox[] = []
    do {
      // 1. Get Spaces Starting in next 15 min whose notification is unprocessed
      const trendingSpaces = await w2wRepository.getTrendingSpacesPagination(
        page,
        pageLimit,
        SpacesSortByOptions.TIMESTAMP,
        SortOrderOptions.ASC
      )
      const currentTime = new Date()
      const spaceStartLimit = new Date(currentTime.getTime() + SPACE_START_LIMIT)
      filteredTrendingSpaces = await Promise.all(
        trendingSpaces.map(async (space) => {
          const UPCMING_SPACE_REDIS_KEY = `SPACE::UPCOMING::${space.spaceInformation.spaceId}`
          const existInRedis = await redisClient.exists(UPCMING_SPACE_REDIS_KEY)
          if (space.spaceInformation.scheduleAt < spaceStartLimit && existInRedis !== 1) {
            return space
          }
          return null
        })
      )
      // Remove null values from the filteredTrendingSpaces array
      filteredTrendingSpaces = filteredTrendingSpaces.filter((space) => space !== null)

      // 2. Send Notification for Each Space and add to cache
      for (let spaceNum = 0; spaceNum < filteredTrendingSpaces.length; spaceNum++) {
        const spaceInfo = filteredTrendingSpaces[spaceNum].spaceInformation
        await this.sendSpaceNotification(spaceInfo, PUSH_CHAT_NOTIFICATION.UPCOMING_SPACE)
        const UPCMING_SPACE_REDIS_KEY = `SPACE::UPCOMING::${spaceInfo.spaceId}`
        await redisClient.set(UPCMING_SPACE_REDIS_KEY, 'PUSH SPACE NOTIFICATION SENT')
        await redisClient.expire(UPCMING_SPACE_REDIS_KEY, 3600) //expire in 1h
      }
      page++
    } while (filteredTrendingSpaces.length > 0)
  }

  /**
   * Sends Internal Push Notification for 'PUSH_CHAT' | 'PUSH_SPACE'
   * Used By
   * @param event Chat Event for Which Notification is sent
   * @param sender Notification Sender
   * @param chatId ChatId or SpaceId
   * @param signature pgp signature
   * @param signedHash signed Hash by pgp Signature
   */
  private async sendNotification(
    event: PUSH_CHAT_NOTIFICATION,
    sender: string,
    chatId: string,
    signature: string,
    signedHash: string
  ): Promise<void> {
    try {
      /**
       * 1. GENERATE VERIFICATION PROOF
       */
      const verificationProof = `pgpv2:${signature}:internal:${chatId}::uid::${Date.now().toString()}`

      /**
       * 2. GENERATE SENDER_TYPE AND NOTIFICATION TITLE
       */
      let senderType: 1 | 2
      let notificationTitle: string
      const user: User = await w2wRepository.getUser(sender)
      const senderName = user && user.name && user.name.includes('.eth') ? user.name : sender
      const chat: Chat = await w2wRepository.getChatByChatIdV2({ chatId })
      const groupName = chat && chat.groupName ? chat.groupName : '' // group or space name
      switch (event) {
        case PUSH_CHAT_NOTIFICATION.CREATE_MESSAGE: {
          senderType = config.senderType.w2w
          notificationTitle = `New message from ${senderName}`
          break
        }
        case PUSH_CHAT_NOTIFICATION.CREATE_INTENT: {
          senderType = config.senderType.w2w
          notificationTitle = `New message request from ${senderName}`
          break
        }
        case PUSH_CHAT_NOTIFICATION.CREATE_GROUP: {
          senderType = config.senderType.w2w
          notificationTitle = `${senderName} wants to add you in group '${groupName}'`
          break
        }
        case PUSH_CHAT_NOTIFICATION.UPDATE_GROUP: {
          senderType = config.senderType.w2w
          notificationTitle = `${senderName} updated the group '${groupName}'`
          break
        }
        case PUSH_CHAT_NOTIFICATION.CREATE_SPACE: {
          senderType = config.senderType.pushSpace
          notificationTitle = `${senderName} wants to add you in space '${groupName}'`
          break
        }
        case PUSH_CHAT_NOTIFICATION.UPDATE_SPACE: {
          senderType = config.senderType.pushSpace
          notificationTitle = `${senderName} updated the space '${groupName}'`
          break
        }
        case PUSH_CHAT_NOTIFICATION.START_SPACE: {
          senderType = config.senderType.pushSpace
          notificationTitle = `space '${groupName}' has started`
          break
        }
        case PUSH_CHAT_NOTIFICATION.END_SPACE: {
          senderType = config.senderType.pushSpace
          notificationTitle = `space '${groupName}' has ended`
          break
        }
        case PUSH_CHAT_NOTIFICATION.UPCOMING_SPACE: {
          senderType = config.senderType.pushSpace
          notificationTitle = `space '${groupName}' is starting soon`
          break
        }
      }

      /**
       * 3. GENERATE IDENTITY BYTES WITH DIRECT PAYLOAD
       * Note: Notifications with source 'PUSH_CHAT' | 'PUSH_SPACE' are always hidden and have expiry time
       */
      const notificationExpiryTime = new Date().getTime() / 1000 + 15 // 10s after Current Time
      const payload = {
        notification: {
          title: notificationTitle,
          body: notificationTitle
        },
        data: {
          acta: '',
          aimg: '',
          amsg: notificationTitle,
          asub: notificationTitle,
          type: 1, // broadcast
          hidden: 1, // hidden
          etime: notificationExpiryTime,
          // Additional Meta contains the actual data that was signed
          additionalMeta: {
            type: '0+1', // Custom Type | Version 1  ...This might be standardized later
            data: signedHash,
            domain: 'push.org'
          }
        }
      }
      const identityBytes = `2+${JSON.stringify(payload)}`

      /**
       * 4. GENERATE RECEIVER
       * Note - Internal Notifications are always Broadcast Notifications
       */
      const recipient = sender

      /**
       * 5. GENERATE SOURCE
       */
      const source = senderType === config.senderType.w2w ? 'PUSH_CHAT' : 'PUSH_SPACES'

      /**
       * 6. TRIGGER NOTIFICATION
       */
      const payloadService = Container.get(PayloadsService)
      await payloadService.addExternalPayload(
        verificationProof,
        sender,
        senderType,
        recipient,
        source,
        identityBytes
      )
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('Error when sending notification: ', err)
    }
  }

  /**
   * Helper for sendNotification for spaces
   * @param space: spaceInformation
   */
  public async sendSpaceNotification(
    space: SpaceDTO,
    event: PUSH_CHAT_NOTIFICATION,
    signedPayload?: Object,
    verificationProof?: string
  ): Promise<void> {
    let signedBody: any = {}
    if (signedPayload) {
      signedBody = signedPayload
    } else {
      //extract admin and members from SpaceDTO
      const admins: string[] = []
      const members: string[] = []
      space.members.map((member) => {
        if (member.isSpeaker && member.wallet.toLowerCase() !== space.spaceCreator.toLowerCase())
          admins.push(member.wallet)
        if (member.wallet.toLowerCase() !== space.spaceCreator.toLowerCase())
          members.push(member.wallet)
      })
      space.pendingMembers.map((member) => {
        if (member.isSpeaker && member.wallet.toLowerCase() !== space.spaceCreator.toLowerCase())
          admins.push(member.wallet)
        if (member.wallet.toLowerCase() !== space.spaceCreator.toLowerCase())
          members.push(member.wallet)
      })

      signedBody = {
        groupName: space.spaceName,
        groupDescription: space.spaceDescription,
        members,
        groupImage: space.spaceImage,
        admins,
        isPublic: space.isPublic,
        contractAddressNFT: space.contractAddressNFT,
        numberOfNFTs: 0,
        contractAddressERC20: space.contractAddressERC20,
        numberOfERC20: space.numberOfERC20,
        groupCreator: space.spaceCreator
      }
    }

    const vProof = verificationProof || space.verificationProof
    await this.sendNotification(
      event,
      space.spaceCreator,
      space.spaceId,
      vProof.split(':')[1],
      CryptoJs.SHA256(JSON.stringify(signedBody)).toString()
    )
  }

  public async addToSpaceWaitlist(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(req.body.email)) {
        return res.status(400).json('Invalid Email')
      }
      const result = await w2wRepository.addToSpaceWaitlist(req.body.email)
      if (result) {
        return res.status(201).json('Succesfully added to waitlist')
      } else {
        return res.status(400).json('Error while adding to waitlist')
      }
    } catch (error) {
      return handleError(error, next)
    }
  }

  public async getSecretKey(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const sessionKey = req.params.sessionKey
      const encryptedSecret = await w2wRepository.getEncryptedSecretBySessionKey({ sessionKey })
      if (!encryptedSecret) {
        return res.status(400).json('No encrypted secret found')
      }
      return res.status(200).json({ encryptedSecret: encryptedSecret })
    } catch (e) {
      const logger: Logger = Container.get('logger')
      logger.error('Error: %o', e)
      return next(e)
    }
  }
}

async function getChatStatusWithChatId(req: Request, res: Response): Promise<Response> {
  const chatId = req.params.recipient
  const addressId = req.params.current

  if (!chatId || !addressId) {
    throw new ValidationError(
      HttpStatus.BadRequest,
      CommonErrors.InvalidAPIInput,
      'Invalid input',
      'Chat ID and Address ID are required.'
    )
  }

  try {
    const chatStatus = await w2wRepository.getChatStatus(chatId, addressId)
    return res.status(200).json(chatStatus)
  } catch (err) {
    if (err instanceof ValidationError) {
      const errorResponse = {
        status: err.status,
        errorCode: err.errorCode,
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString()
      }
      return res.status(err.status).json(errorResponse)
    }
    return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
  }
}

async function getOneToOneChatInfo(req: Request, res: Response): Promise<Response> {
  const recipient = req.params.recipient // recipient
  const requestor = req.params.current // sender

  if (!recipient || !requestor) {
    throw new ValidationError(
      HttpStatus.BadRequest,
      CommonErrors.InvalidAPIInput,
      'Invalid input',
      'Address One and Address Two are required.'
    )
  }

  try {
    const { combinedDID: combDID } = combinedWalletDID({
      firstDID: recipient,
      secondDID: requestor
    })
    const combinedDID = combDID
    const chat = await w2wRepository.getChat({
      combinedDID: combinedDID,
      isGroup: false,
      chatId: null
    })

    if (!chat) {
      const response = {
        meta: null,
        list: 'UNINITIALIZED',
        chatId: null,
        participants: []
      }
      return res.status(200).json(response)
    }

    let listStatus = 'UNINITIALIZED'
    const isInIntentRequestor =
      chat.intent && chat.intent.toLowerCase().includes(requestor.toLowerCase())

    if (isInIntentRequestor) {
      listStatus = 'CHATS'
    } else {
      listStatus = 'REQUESTS'
    }

    const participants = combinedDID ? combinedDID.split('_') : [recipient, requestor]
    const participantInfo = await fetchParticipants(combinedDID)
    const recipientInfo = participantInfo.find(
      (info) => info.participantId.toLowerCase() === recipient.toLowerCase()
    )
    const encrypted = recipientInfo ? recipientInfo.pushUser : false
    const visibility = listStatus === 'CHATS' || (listStatus === 'REQUESTS' && !encrypted)

    const response = {
      meta: {
        group: false,
        groupInfo: null,
        recipients: participantInfo,
        encrypted: encrypted,
        visibility: visibility
      },
      list: listStatus,
      chatId: chat.chatId,
      participants: participants
    }

    return res.status(200).json(response)
  } catch (err) {
    if (err instanceof ValidationError) {
      const errorResponse = {
        status: err.status,
        errorCode: err.errorCode,
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString()
      }
      return res.status(err.status).json(errorResponse)
    }
    return res.status(500).json(ErrorHandler.generateGenericErrorResponse(err.message))
  }
}

async function updateUserHelper(req: Request): Promise<Result> {
  if (!req.body.verificationProof) {
    return { success: false, error: 'No valid verificationProof' }
  }

  const body = req.body
  const did: string = req.params.did
  const caip10: string = req.body.caip10 as string
  const profilePictureCID: string = req.body.profilePictureCID as string
  const name: string = req.body.name as string

  if (isValidNFTAddress(caip10)) {
    body.nftOwner = await getNFTOwner(caip10)
  } else {
    body.nftOwner = null
  }

  const publicKey: string = req.body.publicKey as string
  const encryptedPrivateKey: string = req.body.encryptedPrivateKey as string

  let encryptedPrivateKeyJson
  let encryptionType

  try {
    encryptedPrivateKeyJson = JSON.parse(encryptedPrivateKey)
    encryptionType = encryptedPrivateKeyJson.version
  } catch (error) {
    encryptionType = ENC_TYPE_V0
  }

  const nftOwner: string = req.body.nftOwner as string

  let signature: string
  let sigType: string
  let chainId: number = null
  if (body.verificationProof.split(':').length == 2) {
    signature = req.body.verificationProof.split(':')[1]
    sigType = req.body.verificationProof.split(':')[0]
  }

  if (body.verificationProof.split(':').length == 3) {
    signature = req.body.verificationProof.split(':')[2]
    sigType = req.body.verificationProof.split(':')[0]
    chainId = req.body.verificationProof.split(':')[1]
  }

  let user: User = await w2wRepository.getUser(did)
  if (!user) {
    return { success: false, error: 'Invalid signer' }
  }

  if (!signature || !sigType) {
    return { success: false, error: 'No valid verificationProof' }
  }

  // for backward compatiility
  if (sigType === SIG_TYPE_V2) {
    if (!(await verifyEIP712Signature(body, signature, chainId))) {
      return { success: false, error: 'Invalid signer' }
    }
  }

  if (sigType === SIG_TYPE_V3) {
    if (!(await verifyEIP191Signature(body, signature))) {
      return { success: false, error: 'Invalid signer' }
    }
  }

  if (sigType === SIG_TYPE_V4) {
    const updatedBody = body
    updatedBody.did = did
    if (!(await verifyEIP191V2Signature(updatedBody, signature))) {
      return { success: false, error: 'Invalid signer' }
    }
  }

  switch (encryptionType) {
    case ENC_TYPE_V0: {
      if (publicKey !== '' && encryptedPrivateKey !== '') {
        return { success: false, error: 'Invalid PUSH Chat Key Structure' }
      }
      break
    }
    case ENC_TYPE_V1: {
      const { error } = PRIVATE_KEY_SCHEMA_V1.validate(JSON.parse(encryptedPrivateKey))
      if (error || publicKey === '') {
        return { success: false, error: 'Invalid PUSH Chat Key Structure' }
      }
      break
    }
    case ENC_TYPE_V2: {
      const { error: privateKeyError } = PRIVATE_KEY_SCHEMA_V2.validate(
        JSON.parse(encryptedPrivateKey)
      )
      const { error: publicKeyError } = PUBLIC_KEY_SCHEMA_V2.validate(JSON.parse(publicKey))
      if (privateKeyError || publicKeyError) {
        return { success: false, error: 'Invalid PUSH Chat Key Structure' }
      }
      break
    }
    case ENC_TYPE_V3: {
      const { error: privateKeyError } = PRIVATE_KEY_SCHEMA_V3.validate(
        JSON.parse(encryptedPrivateKey)
      )
      const { error: publicKeyError } = PUBLIC_KEY_SCHEMA_V3.validate(JSON.parse(publicKey))
      if (privateKeyError || publicKeyError) {
        return { success: false, error: 'Invalid PUSH Chat Key Structure' }
      }
      break
    }
    case ENC_TYPE_V4: {
      const { error: privateKeyError } = PRIVATE_KEY_SCHEMA_V4.validate(
        JSON.parse(encryptedPrivateKey)
      )
      const { error: publicKeyError } = PUBLIC_KEY_SCHEMA_V4.validate(JSON.parse(publicKey))
      if (privateKeyError || publicKeyError) {
        return { success: false, error: 'Invalid PUSH Chat Key Structure' }
      }
      break
    }
    case ENC_TYPE_V5: {
      const { error: privateKeyError } = PRIVATE_KEY_SCHEMA_V5.validate(
        JSON.parse(encryptedPrivateKey)
      )
      const { error: publicKeyError } = PUBLIC_KEY_SCHEMA_V5.validate(publicKey)
      if (privateKeyError || publicKeyError) {
        return { success: false, error: 'Invalid PUSH Chat Key Structure' }
      }
      break
    }
    default:
      return { success: false, error: 'Invalid Encryption Type' }
  }

  if (profilePictureCID) {
    try {
      CID.parse(profilePictureCID) // Will throw exception if invalid CID
    } catch (err) {
      return { success: false, error: 'Invalid CID' }
    }
  }

  if (caip10) {
    if (!user.wallets.includes(caip10)) {
      // We need to update the wallets on both w2w_meta
      await w2wRepository.addWallet(did, caip10)
    }
  }

  sigType = chainId ? `${sigType}:${chainId}` : sigType
  const updateUserRequest = {
    did: did,
    publicKey: publicKey ? publicKey : user.publicKey,
    encryptedPrivateKey: encryptedPrivateKey ? encryptedPrivateKey : user.encryptedPrivateKey,
    nftOwner: nftOwner ? nftOwner : user.nftOwner,
    signature: signature ? signature : user.signature,
    sigType: sigType ? sigType : user.sigType,
    profile: {
      picture: profilePictureCID ? profilePictureCID : user.profilePicture,
      name: name ? name : user.name,
      desc: user.about,
      blockedUsersList: [],
      profileVerificationProof: null
    }
  }
  user = await w2wRepository.updateUser(updateUserRequest)

  return { success: true, data: user }
}

async function createUserHelper(req: Request): Promise<Result> {
  try {
    const body = req.body
    let signature: string
    let sigType: string
    let chainId: number = null
    if (!body.verificationProof) {
      body.verificationProof = `${body.sigType}:${body.signature}`
    }

    if (isValidNFTAddress(body.caip10)) {
      body.nftOwner = await getNFTOwner(body.caip10)
    } else {
      body.nftOwner = null
    }

    //older format
    if (body.verificationProof.split(':').length == 2) {
      signature = body.verificationProof
        ? body.verificationProof.split(':')[1]
        : (body.signature as string)
      sigType = body.verificationProof
        ? body.verificationProof.split(':')[0]
        : (body.sigType as string)
    }
    // in the format eip712v2:<chainid>:<signature>
    if (body.verificationProof.split(':').length == 3) {
      signature = body.verificationProof
        ? body.verificationProof.split(':')[2]
        : (body.signature as string)
      sigType = body.verificationProof
        ? body.verificationProof.split(':')[0]
        : (body.sigType as string)
      chainId = body.verificationProof
        ? parseInt(body.verificationProof.split(':')[1])
        : (body.chainId as number)
    }

    // TODO: Uncomment after Nilesh signature changes
    if (!signature || !sigType) {
      return { success: false, error: 'No valid verificationProof' }
    }

    // for backward compatiility
    if (sigType === SIG_TYPE_V2) {
      if (!(await verifyEIP712Signature(body, signature, chainId))) {
        return { success: false, error: 'Invalid signer' }
      }
    }

    if (sigType === SIG_TYPE_V3) {
      if (!(await verifyEIP191Signature(body, signature))) {
        return { success: false, error: 'Invalid signer' }
      }
    }

    if (sigType === SIG_TYPE_V4) {
      if (!(await verifyEIP191V2Signature(body, signature))) {
        return { success: false, error: 'Invalid signer' }
      }
    }

    const caip10: string = body.caip10
    const did: string = body.did
    const publicKey = body.publicKey
    const encryptedPrivateKey = body.encryptedPrivateKey

    let encryptedPrivateKeyJson
    let encryptionType

    try {
      encryptedPrivateKeyJson = JSON.parse(body.encryptedPrivateKey)
      encryptionType = encryptedPrivateKeyJson.version
    } catch (error) {
      encryptionType = ENC_TYPE_V0
    }

    const nftOwner = body.nftOwner

    let name: string = body.name

    if (!did || !caip10) {
      return { success: false, error: 'Invalid body request' }
    }
    if (!isValidCAIP10Address(caip10)) {
      return { success: false, error: 'Invalid wallet format' }
    }
    if (!did.includes('did:3:') && did !== caip10) {
      return { success: false, error: 'DID is incorrect' }
    }

    switch (encryptionType) {
      case ENC_TYPE_V0: {
        if (publicKey !== '' && encryptedPrivateKey !== '') {
          return { success: false, error: 'Invalid PUSH Chat Key Structure' }
        }
        break
      }
      case ENC_TYPE_V1: {
        const { error } = PRIVATE_KEY_SCHEMA_V1.validate(JSON.parse(encryptedPrivateKey))
        if (error || publicKey === '') {
          return { success: false, error: 'Invalid PUSH Chat Key Structure' }
        }
        break
      }
      case ENC_TYPE_V2: {
        const { error: privateKeyError } = PRIVATE_KEY_SCHEMA_V2.validate(
          JSON.parse(encryptedPrivateKey)
        )
        const { error: publicKeyError } = PUBLIC_KEY_SCHEMA_V2.validate(JSON.parse(publicKey))
        if (privateKeyError || publicKeyError) {
          return { success: false, error: 'Invalid PUSH Chat Key Structure' }
        }
        break
      }
      case ENC_TYPE_V3: {
        const { error: privateKeyError } = PRIVATE_KEY_SCHEMA_V3.validate(
          JSON.parse(encryptedPrivateKey)
        )
        const { error: publicKeyError } = PUBLIC_KEY_SCHEMA_V3.validate(JSON.parse(publicKey))
        if (privateKeyError || publicKeyError) {
          return { success: false, error: 'Invalid PUSH Chat Key Structure' }
        }
        break
      }
      case ENC_TYPE_V4: {
        const { error: privateKeyError } = PRIVATE_KEY_SCHEMA_V4.validate(
          JSON.parse(encryptedPrivateKey)
        )
        const { error: publicKeyError } = PUBLIC_KEY_SCHEMA_V4.validate(JSON.parse(publicKey))
        if (privateKeyError || publicKeyError) {
          return { success: false, error: 'Invalid PUSH Chat Key Structure' }
        }
        break
      }
      case ENC_TYPE_V5: {
        const { error: privateKeyError } = PRIVATE_KEY_SCHEMA_V5.validate(
          JSON.parse(encryptedPrivateKey)
        )
        const { error: publicKeyError } = PUBLIC_KEY_SCHEMA_V5.validate(publicKey)
        if (privateKeyError || publicKeyError) {
          return { success: false, error: 'Invalid PUSH Chat Key Structure' }
        }
        break
      }
      default:
        return { success: false, error: 'Invalid Encryption Type' }
    }

    let user: User = await w2wRepository.getUser(did)

    // Check if user has pgp keys created
    sigType = chainId ? `${sigType}:${chainId}` : sigType
    if (user && !user.publicKey && !user.encryptedPrivateKey) {
      const updatedUser: User = await w2wRepository.updateUser({
        did,
        publicKey,
        encryptedPrivateKey,
        nftOwner,
        signature,
        sigType,
        profile: {
          picture: user.profilePicture,
          name: user.name,
          desc: user.about,
          blockedUsersList: [],
          profileVerificationProof: null
        }
      })
      return { success: true, data: updatedUser }
    } else {
      if (!name) {
        // This exists because before there was a logic to resolve the ens name and when no name was found, it was set to null.
        // We manually setting now to null so we don't break any client. Otherwise, we would be returning name as empty string instead of null
        name = null
      }
      const randomProfile = createRandomNameAndProfile(caip10)
      user = {
        did,
        wallets: caip10,
        publicKey,
        encryptedPrivateKey,
        encryptionType,
        encryptedPassword: null,
        nftOwner,
        signature,
        sigType,
        profilePicture: randomProfile.uniqueAvatar,
        about: null,
        name,
        numMsg: 0,
        allowedNumMsg: MAX_MESSAGES_W2W,
        linkedListHash: '',
        origin: body.origin
      }
      try {
        await w2wRepository.createUser(user)
      } catch (err) {
        user = await w2wRepository.getUser(did)
      }
      return { success: true, data: user }
    }
  } catch (err) {
    const logger: Logger = Container.get('logger')
    logger.error('Error: %o', err)
    throw err
  }
}

async function verifyEIP712Signature(
  data: Record<UPDATE_USER_SIGNATURE_KEYS, string>,
  signature: string,
  chainId: number
) {
  const contentToBeHashed = _.pick(data, [
    'caip10',
    'did',
    'publicKey',
    'encryptedPrivateKey',
    'encryptionType',
    'name',
    'encryptedPassword',
    'nftOwner'
  ])

  const contentHash = cryptoHelper.generateHash(contentToBeHashed)
  const recoveredAddress = payloadVerificationHelper.verifyEip712ProofV2(
    signature,
    contentHash,
    chainId ?? null,
    chainId ? config.chatVerifyingContract : null,
    chainId ? false : true,
    'PUSH CHAT ID'
  )
  const signer = isValidNFTAddress(data.caip10) ? data.nftOwner : data.caip10
  return signer.toLowerCase() == `eip155:${recoveredAddress}`.toLowerCase()
}

async function verifyEIP191Signature(
  data: Record<UPDATE_USER_SIGNATURE_KEYS, string>,
  signature: string
) {
  const contentToBeHashed = _.pick(data, [
    'caip10',
    'did',
    'publicKey',
    'encryptedPrivateKey',
    'encryptionType',
    'name',
    'encryptedPassword',
    'nftOwner'
  ])

  const contentHash = cryptoHelper.generateHash(contentToBeHashed)
  const recoveredAddress = ethers.utils.recoverAddress(
    ethers.utils.hashMessage(contentHash),
    signature
  )
  const signer = isValidNFTAddress(data.caip10) ? data.nftOwner : data.caip10

  return signer.toLowerCase() == `eip155:${recoveredAddress}`.toLowerCase()
}

async function verifyEIP191V2Signature(
  data: Record<UPDATE_USER_SIGNATURE_KEYS, string>,
  signature: string
) {
  const contentToBeHashed = _.pick(data, ['caip10', 'did', 'publicKey', 'encryptedPrivateKey'])
  const contentHash: string = cryptoHelper.generateHash(contentToBeHashed)

  const signer = isValidNFTAddress(data.caip10) ? data.nftOwner : data.caip10
  const isSCW = isValidSCWAddress(signer)

  if (!isSCW) {
    const recoveredAddress = ethers.utils.recoverAddress(
      ethers.utils.hashMessage(contentHash),
      signature
    )
    return signer.toLowerCase() == `eip155:${recoveredAddress}`.toLowerCase()
  } else {
    // scw:eip155:chainId:address
    const chainId = parseInt(signer.split(':')[2])

    try {
      const provider = config.CHAIN_ID_TO_PROVIDER[chainId] || config.web3EthereumProvider
      const isValidSig: boolean = await verifyMessage({
        signer: signer.split(':')[3].toLowerCase(), // contract address
        message: contentHash,
        signature: signature,
        provider: new ethers.providers.JsonRpcProvider(provider)
      })
      return isValidSig
    } catch (err) {
      return false
    }
  }
}

async function getUserCommon(req: Request, res: Response, isV2: boolean): Promise<any> {
  const did: string = (req.query.did as string) ?? (req.query.caip10 as string)

  if (!did) {
    return res.status(400).send('Invalid request')
  }
  if (!isValidCAIP10Address(did) && !isValidNFTAddressV2(did)) {
    return res.status(400).send('Invalid wallet format')
  }
  const user = isV2 ? await w2wRepository.getUserV2(did) : await w2wRepository.getUser(did)
  return user
}

async function handleError(err: any, next: NextFunction): Promise<void> {
  const logger: Logger = Container.get('logger')
  logger.error('Error: %o', err)
  return next(err)
}

async function getUsersCommon(req: Request, res: Response, isV2: boolean): Promise<any> {
  const userIds: string[] = req.body.userIds as string[]
  const users = []
  let countFound = 0
  let countNotFound = 0

  if (!userIds || userIds.length === 0) {
    throw new ValidationError(
      HttpStatus.BadRequest,
      CommonErrors.InvalidAPIInput,
      'Invalid request',
      'User IDs are required.'
    )
  }

  const uniqueIds = new Set(userIds)
  if (uniqueIds.size !== userIds.length) {
    throw new ValidationError(
      HttpStatus.BadRequest,
      CommonErrors.InvalidAPIInput,
      'Duplicate user IDs found in the request',
      ''
    )
  }

  if (userIds.length > 100) {
    throw new ValidationError(
      HttpStatus.BadRequest,
      CommonErrors.InvalidAPIInput,
      'Maximum of 100 user IDs allowed per request',
      ''
    )
  }

  userIds.forEach((userId) => {
    if (!isValidCAIP10Address(userId)) {
      throw new ValidationError(
        HttpStatus.BadRequest,
        CommonErrors.InvalidAPIInput,
        'Invalid wallet format',
        ''
      )
    }
  })

  for (const userId of userIds) {
    const user = isV2 ? await w2wRepository.getUserV2(userId) : await w2wRepository.getUser(userId)
    if (user != null) {
      countFound++
      users.push(user)
    } else {
      countNotFound++
    }
  }

  const response = {
    users,
    countFound,
    countNotFound
  }
  return response
}

export async function getGroupDTO(chatId: string): Promise<GroupDTO | null> {
  const chat: Chat = await w2wRepository.getChatByChatId({ chatId })
  if (!chat) return null
  return await getGroupDTOHelper(chat)
}

export async function getLimitedGroupDTO(chatId: string): Promise<GroupDTO | null> {
  const chat: Chat = await w2wRepository.getChatByChatId({ chatId })
  if (!chat) return null
  return await getLimitedGroupDTOHelper(chat)
}

export async function getGroupInfoDTO(chatId: string): Promise<GroupInfoDTO | null> {
  const chat: Chat = await w2wRepository.getChatByChatIdV2({ chatId })
  if (!chat) {
    throw new ValidationError(
      HttpStatus.NotFound,
      CommonErrors.ChatNotFound,
      'Invalid chat',
      `Chat with ID ${chatId} could not be found.`
    )
  }

  const encryptedSecret = await w2wRepository.getEncryptedSecretBySessionKey({
    sessionKey: chat.sessionKey
  })

  return {
    groupName: chat.groupName,
    groupDescription: chat.groupDescription,
    groupImage: chat.groupImage,
    meta: chat.meta,
    scheduleAt: chat.scheduleAt,
    scheduleEnd: chat.scheduleEnd,
    rules: chat.rules,
    status: chat.status,
    isPublic: chat.isPublic ? true : false,
    groupType: chat.groupType,
    chatId: chat.chatId,
    profileVerificationProof: chat.profileVerificationProof,
    // Not bound by profile verification proof
    groupCreator: chat.intentSentBy,
    encryptedSecret: encryptedSecret ?? null,
    sessionKey: chat.sessionKey
  }
}

export async function getSpaceDTO(chatId: string): Promise<SpaceDTO | null> {
  const chat: Chat = await w2wRepository.getChatByChatId({ chatId })
  if (!chat) return null
  const group: GroupDTO = await getGroupDTOHelper(chat)
  return convertGroupToSpace(group)
}

export function convertGroupToSpace(group: GroupDTO | GroupInfoDTO): SpaceDTO {
  return {
    members: group.members
      ? group.members.map((member) => ({
          wallet: member.wallet,
          publicKey: member.publicKey,
          isSpeaker: member.isAdmin,
          image: member.image
        }))
      : [],
    pendingMembers: group.pendingMembers
      ? group.pendingMembers.map((pendingMember) => ({
          wallet: pendingMember.wallet,
          publicKey: pendingMember.publicKey,
          isSpeaker: pendingMember.isAdmin,
          image: pendingMember.image
        }))
      : [],
    contractAddressERC20: group.contractAddressERC20,
    numberOfERC20: group.numberOfERC20,
    contractAddressNFT: group.contractAddressNFT,
    numberOfNFTTokens: group.numberOfNFTTokens,
    verificationProof: group.verificationProof,
    spaceImage: group.groupImage,
    spaceName: group.groupName,
    isPublic: group.isPublic,
    spaceDescription: group.groupDescription,
    spaceCreator: group.groupCreator,
    spaceId: group.chatId,
    meta: group.meta,
    scheduleAt: group.scheduleAt,
    scheduleEnd: group.scheduleEnd,
    status: group.status,
    rules: group.rules
  }
}

export async function getGroupDTOHelper(chat: Chat): Promise<GroupDTO> {
  if (!chat) throw new Error(`Invalid chat`)
  const encryptedSecret = await w2wRepository.getEncryptedSecretBySessionKey({
    sessionKey: chat.sessionKey
  })

  // Fetch all members and their public keys, private keys, and profiles in one go
  const membersData = await w2wRepository.fetchAllChatMembersWithProfile(chat.chatId)

  const groupReturn: GroupDTO = {
    members: [],
    pendingMembers: [],
    contractAddressERC20: chat.contractAddressERC20,
    numberOfERC20: chat.numberOfERC20,
    contractAddressNFT: chat.contractAddressNFT,
    numberOfNFTTokens: chat.numberOfNFTs,
    verificationProof: chat.verificationProof,
    groupImage: chat.groupImage,
    groupName: chat.groupName,
    groupDescription: chat.groupDescription,
    isPublic: chat.isPublic ? true : false,
    groupCreator: chat.intentSentBy,
    chatId: chat.chatId,
    meta: chat.meta,
    scheduleAt: chat.scheduleAt,
    scheduleEnd: chat.scheduleEnd,
    groupType: chat.groupType,
    status: chat.status,
    encryptedSecret: encryptedSecret ?? null,
    sessionKey: chat.sessionKey,
    rules: chat.rules
  }

  const intentArray = chat.intent.toLowerCase().split('+')
  const adminArray = chat.admins ? chat.admins.toLowerCase().split('_') : []

  // Process members data to categorize into members and pendingMembers
  for (const memberData of membersData) {
    const isMember = intentArray.includes(memberData.address.toLowerCase())
    const isAdmin = adminArray.includes(memberData.address.toLowerCase())

    const memberInfo = {
      wallet: memberData.address,
      publicKey: memberData.userInfo.publicKey,
      isAdmin,
      image: memberData.userInfo.profile.picture
    }

    if (isMember) {
      groupReturn.members.push(memberInfo)
    } else {
      groupReturn.pendingMembers.push(memberInfo)
    }
  }
  return groupReturn
}

/**
 * GET GROUP DTO WITH LIMITED MEMBERS ( THIS FN ONLY RETURNS GRP WITH 1000 MEMBERS)
 * Currently used by getchats / getChat for backward compatibility
 * @notice - This function is not used anywhere else
 * @notice - In future, we should remove this function and use getGroupInfoDTO instead
 */
export async function getLimitedGroupDTOHelper(chat: Chat): Promise<GroupDTO> {
  if (!chat) throw new Error(`Invalid chat`)
  const encryptedSecret = await w2wRepository.getEncryptedSecretBySessionKey({
    sessionKey: chat.sessionKey
  })

  // Fetch first 1000 members
  const membersData = await w2wRepository.fetchChatMembersWithProfile(chat.chatId, 100, 1)

  const groupReturn: GroupDTO = {
    members: [],
    pendingMembers: [],
    contractAddressERC20: chat.contractAddressERC20,
    numberOfERC20: chat.numberOfERC20,
    contractAddressNFT: chat.contractAddressNFT,
    numberOfNFTTokens: chat.numberOfNFTs,
    verificationProof: chat.verificationProof,
    groupImage: chat.groupImage,
    groupName: chat.groupName,
    groupDescription: chat.groupDescription,
    isPublic: chat.isPublic ? true : false,
    groupCreator: chat.intentSentBy,
    chatId: chat.chatId,
    meta: chat.meta,
    scheduleAt: chat.scheduleAt,
    scheduleEnd: chat.scheduleEnd,
    groupType: chat.groupType,
    status: chat.status,
    encryptedSecret: encryptedSecret ?? null,
    sessionKey: chat.sessionKey,
    rules: chat.rules
  }

  const intentArray = chat.intent.toLowerCase().split('+')
  const adminArray = chat.admins ? chat.admins.toLowerCase().split('_') : []

  // Process members data to categorize into members and pendingMembers
  for (const memberData of membersData) {
    const isMember = intentArray.includes(memberData.address.toLowerCase())
    const isAdmin = adminArray.includes(memberData.address.toLowerCase())

    const memberInfo = {
      wallet: memberData.address,
      publicKey: memberData.userInfo.publicKey,
      isAdmin,
      image: memberData.userInfo.profile.picture
    }

    if (isMember) {
      groupReturn.members.push(memberInfo)
    } else {
      groupReturn.pendingMembers.push(memberInfo)
    }
  }
  return groupReturn
}

// Now use the new function in your original handleEmptyUsersV2 function
async function handleEmptyUsersV2(members: string[]): Promise<void> {
  try {
    const existingUserDIDs = await w2wRepository.getExistingUserDIDs(members)

    // Filter out existing users and create only the missing ones
    const usersToCreate = members.filter((member) => !existingUserDIDs.has(member))
    for (const userDID of usersToCreate) {
      await createEmptyUser(userDID)
    }
  } catch (error) {
    console.error('Error in handleEmptyUsersV2:', error)
    throw error
  }
}

/**
 * @deprecated - use @handleEmptyUsersV2 instead
 */
async function handleEmptyUsers(group: GroupDTO): Promise<void> {
  const members: string[] = group.members.map((member) => member.wallet)
  const pendingMembers: string[] = group.pendingMembers.map((member) => member.wallet)

  for (const wallet of [...members, ...pendingMembers]) {
    const user: User = await w2wRepository.getUser(wallet)
    if (!user) {
      await createEmptyUser(wallet)
    }
  }
}

async function createEmptyUser(did: string): Promise<void> {
  const randomProfile = createRandomNameAndProfile(did)
  const user: User = {
    did,
    wallets: did,
    publicKey: '',
    encryptedPrivateKey: '',
    encryptionType: '',
    encryptedPassword: null,
    nftOwner: null,
    signature: '',
    sigType: '',
    profilePicture: randomProfile.uniqueAvatar,
    about: null,
    name: null,
    numMsg: 0,
    allowedNumMsg: MAX_MESSAGES_W2W
  }
  await w2wRepository.createUser(user)
}

// ** SOCKET EVENTS **

/**
 * EVENTS FOR GROUPS
 * EVENT_TYPE - CREATE | UPDATE
 * @deprecated
 * @param combinedDID members of group
 * @param groupDto groupInformation
 * @param eventType type of event
 */
async function sendGroupSocketEvent(
  combinedDID: string,
  groupDto: any,
  eventType: GroupEventType,
  from: string
): Promise<void> {
  const dids = combinedDID.split('_')
  groupDto.eventType = eventType

  const sendGroupSocketEventToUser = async (from: string, targetDID: string, groupDto: any) => {
    if (isValidNFTAddress(targetDID)) {
      const addressComponents = targetDID.split(':')
      addressComponents.pop()
      targetDID = addressComponents.join(':')
    }
    let messageOrigin = null

    if (targetDID === from) {
      messageOrigin = 'self'
    } else {
      messageOrigin = 'other'
    }

    groupDto.messageOrigin = messageOrigin
    groupDto.timestamp = Date.now()
    groupDto.from = from
    groupDto.isGroup = true

    const user_key = REDIS_KEY_PREFIX_DID + targetDID
    const redisResult = await redisClient.get(user_key)
    const pushSocket: PushSocket = Container.get('pushSocket')
    if (redisResult) {
      const record = JSON.parse(redisResult)
      for (const i in record) {
        await pushSocket.chatEvent.chatGroups(record[i], groupDto)
        const logger: Logger = Container.get('logger')
        logger.info(
          `Chat Group Socket Event sent to ${targetDID} with socketID : ${record[i]}`,
          groupDto
        )
      }
    }
  }

  for (const did of dids) {
    await sendGroupSocketEventToUser(from, did, groupDto)
  }
}

/**
 * EVENTS FOR GROUPS V2
 * EVENT_TYPE - CREATE | UPDATE
 * @param combinedDID members of group
 * @param groupDto groupInformation
 * @param eventType type of event
 */
async function sendGroupSocketEventV2(
  groupInfoDTO: GroupInfoDTO,
  eventType: GroupEventType,
  from: string
): Promise<void> {
  /**
   * Get dids of Grp
   */
  const { combinedDID } = await w2wRepository.getChatByChatId({ chatId: groupInfoDTO.chatId })
  const dids = combinedDID.split('_')

  const sendGroupSocketEventToUser = async (from: string, targetDID: string, groupDto: any) => {
    if (isValidNFTAddress(targetDID)) {
      const addressComponents = targetDID.split(':')
      addressComponents.pop()
      targetDID = addressComponents.join(':')
    }
    let messageOrigin = null

    if (targetDID === from) {
      messageOrigin = 'self'
    } else {
      messageOrigin = 'other'
    }

    groupDto.messageOrigin = messageOrigin
    groupDto.timestamp = Date.now()
    groupDto.from = from
    groupDto.isGroup = true
    groupDto.eventType = eventType

    const user_key = REDIS_KEY_PREFIX_DID + targetDID
    const redisResult = await redisClient.get(user_key)
    const pushSocket: PushSocket = Container.get('pushSocket')
    if (redisResult) {
      const record = JSON.parse(redisResult)
      for (const i in record) {
        await pushSocket.chatEvent.chatGroups(record[i], groupDto)
        const logger: Logger = Container.get('logger')
        logger.info(
          `Chat Group Socket Event sent to ${targetDID} with socketID : ${record[i]}`,
          groupDto
        )
      }
    }
  }

  for (const did of dids) {
    await sendGroupSocketEventToUser(from, did, groupInfoDTO)
  }
}

/**
 * EVENTS FOR SPACES
 * EVENT_TYPE - START | STOP | UPDATE
 * @deprecated
 * @param combinedDID members of the spaces
 * @param spaceDto spaceInformation
 * @param eventType type of event
 */
async function sendSpaceSocketEvent(
  combinedDID: string,
  spaceDto: any,
  eventType: string,
  from: string
): Promise<void> {
  const dids = combinedDID.split('_')
  spaceDto.eventType = eventType

  const sendSpaceSocketEventToUser = async (
    from: string,
    targetDID: string,
    spaceDto: any
  ): Promise<void> => {
    if (isValidNFTAddress(targetDID)) {
      const addressComponents = targetDID.split(':')
      addressComponents.pop()
      targetDID = addressComponents.join(':')
    }
    let messageOrigin
    if (targetDID === from) {
      messageOrigin = 'self'
    } else {
      messageOrigin = 'other'
    }
    spaceDto.messageOrigin = messageOrigin
    spaceDto.timestamp = Date.now()

    const user_key = REDIS_KEY_PREFIX_DID + targetDID
    const redisResult = await redisClient.get(user_key)
    const pushSocket: PushSocket = Container.get('pushSocket')
    if (redisResult) {
      const record = JSON.parse(redisResult)
      for (const i in record) {
        await pushSocket.spaceEvent.spaces(record[i], spaceDto)
        const logger: Logger = Container.get('logger')
        logger.info(
          `Space Socket Event sent to ${targetDID} with socketID : ${record[i]}`,
          spaceDto
        )
      }
    }
  }

  for (const did of dids) {
    await sendSpaceSocketEventToUser(from, did, spaceDto)
  }
}

/**
 * EVENTS FOR SPACES V2
 * EVENT_TYPE - START | STOP | UPDATE
 * @param combinedDID members of the spaces
 * @param spaceDto spaceInformation
 * @param eventType type of event
 */
async function sendSpaceSocketEventV2(
  spaceDto: SpaceDTO,
  eventType: string,
  from: string
): Promise<void> {
  const { combinedDID } = await w2wRepository.getChatByChatId({ chatId: spaceDto.spaceId })
  const dids = combinedDID.split('_')
  spaceDto.eventType = eventType

  const sendSpaceSocketEventToUser = async (
    from: string,
    targetDID: string,
    spaceDto: any
  ): Promise<void> => {
    if (isValidNFTAddress(targetDID)) {
      const addressComponents = targetDID.split(':')
      addressComponents.pop()
      targetDID = addressComponents.join(':')
    }
    let messageOrigin
    if (targetDID === from) {
      messageOrigin = 'self'
    } else {
      messageOrigin = 'other'
    }
    spaceDto.messageOrigin = messageOrigin
    spaceDto.timestamp = Date.now()

    const user_key = REDIS_KEY_PREFIX_DID + targetDID
    const redisResult = await redisClient.get(user_key)
    const pushSocket: PushSocket = Container.get('pushSocket')
    if (redisResult) {
      const record = JSON.parse(redisResult)
      for (const i in record) {
        await pushSocket.spaceEvent.spaces(record[i], spaceDto)
        const logger: Logger = Container.get('logger')
        logger.info(
          `Space Socket Event sent to ${targetDID} with socketID : ${record[i]}`,
          spaceDto
        )
      }
    }
  }

  for (const did of dids) {
    await sendSpaceSocketEventToUser(from, did, spaceDto)
  }
}

/**
 * EVENTS FOR GROUP , SPACES MESSAGES | INTENTS
 * @param combinedDID
 * @param messageWithCID
 * @param isIntentApprove
 * @param isSpace
 */
async function sendMessageSocketEventToGroup(
  combinedDID: string,
  messageWithCID: any,
  isSpace: boolean
) {
  messageWithCID.isGroup = true
  const dids = combinedDID.split('_')
  for (const did of dids) {
    await sendMessageSocketEventToUser(did, messageWithCID, isSpace, true)
  }
}

/**
 * EVENTS FOR MESSAGES | INTENTS
 * Used for Messages and Intents
 * @param targetDID
 * @param messageWithCID
 * @param isIntentApprove
 * @param isSpace
 */
async function sendMessageSocketEventToUser(
  targetDID: string,
  messageWithCID: any,
  isSpace: boolean,
  isGroup: boolean
) {
  // Determine message origin
  let messageOrigin

  if (targetDID === messageWithCID.fromDID) {
    messageOrigin = 'self'
  } else {
    messageOrigin = 'other'
  }

  messageWithCID.messageOrigin = messageOrigin

  // Check if targetDID is a valid NFT address
  if (isValidNFTAddress(targetDID)) {
    // Remove the random hash from targetDID
    const addressComponents = targetDID.split(':')
    addressComponents.pop()
    targetDID = addressComponents.join(':')
  }

  const user_key = REDIS_KEY_PREFIX_DID + targetDID
  const redisResult = await redisClient.get(user_key)
  const pushSocket: PushSocket = Container.get('pushSocket')
  if (redisResult) {
    const record = JSON.parse(redisResult)

    let hasIntent

    if (!isGroup) {
      hasIntent = await w2wRepository.checkMembersIntentForW2W(messageWithCID.chatId)
    } else {
      hasIntent = await w2wRepository.checkMemberIntentForGroup(messageWithCID.chatId, targetDID)
    }

    const logger: Logger = Container.get('logger')
    if (hasIntent === null) {
      logger.info(`No intent record found for ${targetDID} in chatId: ${messageWithCID.chatId}`)
      return
    }

    messageWithCID.hasIntent = hasIntent

    for (const i in record) {
      if (isSpace) {
        await pushSocket.spaceEvent.sendMessageToReceipents(record[i], messageWithCID)
        logger.info(
          `Space Socket Event sent to ${targetDID} with socketID : ${record[i]}`,
          messageWithCID
        )
      } else {
        await pushSocket.chatEvent.chatSendMessageToReceipents(record[i], messageWithCID)
        logger.info(
          `Chat Socket Event sent to ${targetDID} with socketID : ${record[i]}`,
          messageWithCID
        )
      }
    }
  }
}

/**
 * EVENTS FOR INTENTS
 * @param isGroup
 * @param isSpace
 * @param combinedDID
 * @param messageWithCID
 * @param isIntentApprove
 */
async function sendIntentSocketEvent(
  isGroup: boolean,
  isSpace: boolean,
  combinedDID: string,
  messageWithCID: any & {
    cid: string
    chatId: string
  },
  messageCategory: MessageCategory
): Promise<void> {
  messageWithCID.messageCategory = messageCategory

  if (!isGroup) {
    await sendMessageSocketEventToUser(messageWithCID.toDID, messageWithCID, false, false)
    await sendMessageSocketEventToUser(messageWithCID.fromDID, messageWithCID, false, false)
  } else {
    if (!isSpace) {
      await sendMessageSocketEventToGroup(combinedDID, messageWithCID, false)
    } else {
      await sendMessageSocketEventToGroup(combinedDID, messageWithCID, true)
    }
  }
}

/**
 * EVENTS FOR MESSAGE
 * @param isGroup
 * @param combinedDID
 * @param messageWithCID
 * @param chatId
 */
async function sendMessageSocketEvent(isGroup, combinedDID, messageWithCID, chatId): Promise<void> {
  messageWithCID.messageCategory = MessageCategory.Chat
  messageWithCID.chatId = chatId
  if (!isGroup) {
    await sendMessageSocketEventToUser(messageWithCID.toDID, messageWithCID, false, false)
    await sendMessageSocketEventToUser(messageWithCID.fromDID, messageWithCID, false, false)
  } else {
    await sendMessageSocketEventToGroup(combinedDID, messageWithCID, chatId.startsWith('spaces'))
  }
}
