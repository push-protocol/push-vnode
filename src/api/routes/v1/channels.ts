import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../../config'
import { TaggableTypes } from '../../../enums/TaggableTypes'
import {
  convertCaipToAddress,
  convertCaipToObject,
  isValidCAIP10Address
} from '../../../helpers/caipHelper'
import * as caipHelper from '../../../helpers/caipHelper'
import Alias from '../../../services/channelsCompositeClasses/aliasClass'
import Channel from '../../../services/channelsCompositeClasses/channelsClass'
import Subscribers from '../../../services/channelsCompositeClasses/subscribersClass'
import ChannelsService from '../../../services/channelsService'
import FeedsService from '../../../services/feedsService'
import TagsService from '../../../services/TagsService'
import channelsDeprecated from '../deprecated/channels.deprecated'
import channelsInternal from '../internal/channels.internal'

const route = Router()

export default (app: Router) => {
  // load deprecated routes
  channelsDeprecated(app)
  // load internal routes
  channelsInternal(app)

  // Load the actual external routes
  app.use(`/${config.api.version}/channels`, route)
  app.use(errors())

  // Get Channels = get channels + get subscribers
  route.get(
    '/',
    celebrate({
      query: Joi.object({
        page: Joi.number().min(1).default(1),
        limit: Joi.number().default(10).min(1).max(30),
        sort: Joi.string().default('subscribers').valid('subscribers'),
        order: Joi.string().default('desc').valid('asc', 'desc')
      })
    }),
    async (req: Request, res: Response) => {
      const Logger: Logger = Container.get('logger')
      try {
        const channels = Container.get(ChannelsService)
        const aliasClass = Container.get(Alias)

        const response = await channels.getChannels(
          req.query.page,
          req.query.limit,
          req.query.sort,
          req.query.order
        )

        const processedChannels = await Promise.all(
          response.channels.map(async (each) => {
            each.channel = isValidCAIP10Address(each.channel)
              ? convertCaipToAddress(each.channel).result
              : each.channel

            const aliases = await aliasClass.getAliasesForChannel(each.channel)

            // TODO: Remove the firstAlias when changes intgerated with front end
            const firstAlias = aliases && aliases?.length > 0 && aliases[0]

            each.alias_blockchain_id = isValidCAIP10Address(firstAlias.alias_address)
              ? convertCaipToObject(firstAlias.alias_address).result.chainId
              : null

            each.alias_address = firstAlias.alias_address ?? null
            each.is_alias_verified = firstAlias ? firstAlias.is_verified : 0
            each.alias_verification_event = firstAlias ? firstAlias.verification_event : null
            each.initiate_verification_proof = firstAlias
              ? firstAlias.initiate_verification_proof
              : null
            each.verify_verification_proof = firstAlias
              ? firstAlias.verify_verification_proof
              : null

            // Map and transform aliases with additional properties
            const processedAliases = aliases.map((alias) => ({
              ...alias,
              alias_blockchain_id: isValidCAIP10Address(alias.alias_address)
                ? convertCaipToObject(alias.alias_address).result.chainId
                : null,
              alias_address: alias.alias_address
            }))

            return {
              ...each,
              aliases: processedAliases
            }
          })
        )

        response.channels = processedChannels

        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error in /v1/channels/ endpoint : %o', error)
        return res.status(500).json(`🔥 error in /v1/channels/ endpoint : ${error}`)
      }
    }
  )

  route.get(
    '/search',
    celebrate({
      query: Joi.object({
        page: Joi.number().min(1).default(1),
        limit: Joi.number().default(10).min(1).max(30),
        order: Joi.string().default('desc').valid('asc', 'desc'),
        query: Joi.string()
      })
    }),
    async (req: Request, res: Response) => {
      const Logger: Logger = Container.get('logger')
      try {
        const channels = Container.get(ChannelsService)
        const aliasClass = Container.get(Alias)

        const response = await channels.searchV2(
          req.query.page,
          req.query.limit,
          req.query.order,
          req.query.query
        )

        const tagsService = Container.get(TagsService)

        const processedChannels = await Promise.all(
          response.channels.map(async (each) => {
            each.channel = isValidCAIP10Address(each.channel)
              ? convertCaipToAddress(each.channel).result
              : each.channel
            const aliases = await aliasClass.getAliasesForChannel(each.channel)
            const tags = await tagsService.getTagsforResource(each.channel, TaggableTypes.Channel)
            
            // TODO: Remove the firstAlias when changes intgerated with front end
            const firstAlias = aliases && aliases?.length > 0 && aliases[0]

            each.alias_blockchain_id = isValidCAIP10Address(firstAlias.alias_address)
              ? convertCaipToObject(firstAlias.alias_address).result.chainId
              : null

            each.alias_address = firstAlias.alias_address ?? null
            each.is_alias_verified = firstAlias ? firstAlias.is_verified : 0
            each.alias_verification_event = firstAlias ? firstAlias.verification_event : null
            each.initiate_verification_proof = firstAlias
              ? firstAlias.initiate_verification_proof
              : null
            each.verify_verification_proof = firstAlias
              ? firstAlias.verify_verification_proof
              : null

            // Map and transform aliases with additional properties
            const processedAliases = aliases.map((alias) => ({
              ...alias,
              alias_blockchain_id: isValidCAIP10Address(alias.alias_address)
                ? convertCaipToObject(alias.alias_address).result.chainId
                : null,
              alias_address: alias.alias_address
            }))

            return {
              ...each,
              aliases: processedAliases
            }
          })
        )

        response.channels = processedChannels
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error in /v1/channels/ endpoint : %o', error)
        return res.status(500).json(`🔥 error in /v1/channels/ endpoint : ${error}`)
      }
    }
  )

  route.post(
    '/:channelsInCAIP/subscribe',
    celebrate({
      body: Joi.object({
        verificationProof: Joi.string().required(),
        message: Joi.alternatives(Joi.object(), Joi.string()).required(),
        origin: Joi.string().optional()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const channels = Container.get(ChannelsService)
        let subscribeDetails = null
        let sigVersion
        let subscriberCAIPObject
        // const channelCAIPObject
        if (
          req.body.verificationProof.split(':').length < 2 ||
          req.body.verificationProof.split(':')[0] == 'eip712'
        ) {
          subscribeDetails = req.body.message
          sigVersion = `eip712`
        } else if (
          req.body.verificationProof.split(':').length == 2 &&
          req.body.verificationProof.split(':')[0] == 'eip712v2'
        ) {
          subscribeDetails = JSON.parse(req.body.message)
          sigVersion = `eip712v2`
        } else {
          return res.status(403).json('Invalid verificationproof format')
        }
        const channelCAIPObject = convertCaipToObject(req.params.channelsInCAIP)
        if (sigVersion == 'eip712') {
          subscriberCAIPObject = convertCaipToObject(subscribeDetails.subscriber)
          subscribeDetails.channel = channelCAIPObject.result.address
          subscribeDetails.subscriber = subscriberCAIPObject.result.address
        }
        // check if the function returns results and the chain id for both channel and subscribers are same
        const verificationStatus = await channels.addExternalSubscribers(
          sigVersion == 'eip712'
            ? `${sigVersion}:${req.body.verificationProof}`
            : req.body.verificationProof,
          sigVersion == 'eip712' ? req.body.message : JSON.parse(req.body.message),
          parseInt(channelCAIPObject.result.chainId),
          sigVersion,
          req.body.origin
        )
        if (verificationStatus.success) {
          return res.status(204).json('successfully subscribed!')
        } else return res.status(403).json('Error while subscribing')
      } catch (error) {
        Logger.error('🔥 error in /v1/channel/subscribe/ endpoint: %o', JSON.stringify(error))
        return next(error)
      }
    }
  )

  route.post(
    '/:channelsInCAIP/unsubscribe',
    celebrate({
      body: Joi.object({
        verificationProof: Joi.string().required(),
        message: Joi.alternatives(Joi.string(), Joi.object()).required()
      })
    }),
    async (req: Request, res: Response) => {
      const Logger: Logger = Container.get('logger')

      try {
        const channels = Container.get(ChannelsService)
        let unsubscribeDetails = null
        let sigVersion
        let unsubscriberCAIPObject
        if (req.body.verificationProof.split(':').length < 2) {
          unsubscribeDetails = req.body.message
          sigVersion = `eip712`
        } else if (
          req.body.verificationProof.split(':').length == 2 &&
          req.body.verificationProof.split(':')[0] == 'eip712v2'
        ) {
          unsubscribeDetails = JSON.parse(req.body.message)
          sigVersion = `eip712v2`
        } else {
          return res.status(403).json('Invalid verificationproof format')
        }
        const channelCAIPObject = convertCaipToObject(req.params.channelsInCAIP)
        if (sigVersion == 'eip712') {
          unsubscriberCAIPObject = convertCaipToObject(unsubscribeDetails.unsubscriber)
          unsubscribeDetails.channel = channelCAIPObject.result.address
          unsubscribeDetails.unsubscriber = unsubscriberCAIPObject.result.address
        }
        // check if the function returns results and the chain id for both channel and subscribers are same

        const verificationStatus = await channels.removeExternalSubscribers(
          sigVersion == 'eip712'
            ? `${sigVersion}:${req.body.verificationProof}`
            : req.body.verificationProof,
          sigVersion == 'eip712' ? req.body.message : JSON.parse(req.body.message),
          parseInt(channelCAIPObject.result.chainId),
          sigVersion
        )
        if (verificationStatus.success) return res.status(204).json()
        else return res.status(403).json('Error in verifying the signature!')
      } catch (error) {
        Logger.error('🔥 in /v1/channel/unsubscribe/ endpoint: %o', error)
        return res.status(500).json('Something went wrong')
      }
    }
  )

  // Get list of all the delegatees for a channel
  route.get(
    '/:channelAddressinCAIP/delegates/',
    celebrate({
      params: Joi.object({
        channelAddressinCAIP: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const channels = Container.get(Channel)
        const { result: channelAddress, err } = convertCaipToAddress(
          req.params.channelAddressinCAIP
        )
        if (channelAddress && !err) {
          const response = await channels.getDelegateFromChannel(req.params.channelAddressinCAIP)
          const delegates = caipHelper.batchConvertCaipToAddresses(response.delegates)
          return res.status(200).send({ delegates: delegates })
        } else {
          return res.status(403).json('Error in verifying the channelAddress!')
        }
      } catch (error) {
        Logger.error(
          '🔥 error in /v1/channels/:channelAddressinCAIP/delegates/ with error: %o',
          error
        )
        return next(error)
      }
    }
  )

  // Get list of the subscribers for a channel
  route.get(
    '/:channelAddressinCAIP/subscribers/',
    celebrate({
      params: Joi.object({
        channelAddressinCAIP: Joi.string().required()
      }),
      query: Joi.object({
        page: Joi.number().min(1).default(1),
        limit: Joi.number().default(10).min(1).max(30),
        setting: Joi.boolean().default(false).allow(null),
        category: Joi.number().allow(null).default(null)
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      try {
        const { result: channelAddress, err } = convertCaipToObject(req.params.channelAddressinCAIP)
        if (channelAddress && !err) {
          const subscribers = Container.get(Subscribers)
          const response = await subscribers.getSubscribersPaginated(
            req.params.channelAddressinCAIP,
            channelAddress.chainId,
            req.query.page,
            req.query.limit,
            req.query.setting,
            req.query.category
          )
          return res.status(200).send(response)
        } else {
          return res.status(403).json('Error in verifying the channelAddress!')
        }
      } catch (error) {
        Logger.error(
          '🔥 error in /v1/channels/:channelAddressinCAIP/subscribers/ with error: %o',
          error
        )
        return next(error)
      }
    }
  )

  // Get list of the feeds for a channel
  route.get(
    ['/:channelAddressinCAIP/feeds', '/:channelAddressinCAIP/notifications'],
    celebrate({
      params: Joi.object({
        channelAddressinCAIP: Joi.string().required()
      }),
      query: Joi.object({
        page: Joi.number().min(1).default(1),
        limit: Joi.number().default(10).min(1).max(30),
        /**
         * 1 -> Broadcast
         * 3 -> target
         * 4 -> subset
         */
        notificationType: Joi.number().valid(1, 3, 4)
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      try {
        const { result: channelAddress, err } = convertCaipToObject(req.params.channelAddressinCAIP)
        if (channelAddress && !err) {
          const feeds = Container.get(FeedsService)
          const notificationType = req.query.notificationType
            ? Number(req.query.notificationType)
            : (req.query.notificationType as undefined)
          const response = await feeds.getFeedsOfChannel(
            req.params.channelAddressinCAIP,
            Number(req.query.page),
            Number(req.query.limit),
            notificationType
          )
          response.feeds.map(
            (each) =>
              (each.sender = isValidCAIP10Address(each.sender)
                ? convertCaipToAddress(each.sender).result
                : each.sender)
          )
          return res.status(200).send(response)
        } else {
          return res.status(403).json('Error in verifying the channelAddress!')
        }
      } catch (error) {
        Logger.error(
          '🔥 error in /v1/channels/:channelAddressinCAIP/notifications/ with error: %o',
          error
        )
        return next(error)
      }
    }
  )

  // Get channel by address
  route.get(
    '/:channelAddressinCAIP',
    celebrate({
      params: Joi.object({
        channelAddressinCAIP: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')

      try {
        const channels = Container.get(Channel)
        const { result: channelAddress, err } = convertCaipToAddress(
          req.params.channelAddressinCAIP
        )
        if (channelAddress && !err) {
          const response = await channels.getChannel(req.params.channelAddressinCAIP)
          if (!response) {
            return res.status(404).json('channel not found')
          }

          const aliasClass = Container.get(Alias)
          const aliases = await aliasClass.getAliasesForChannel(response.channel)

          response.channel = convertCaipToAddress(response.channel).result
          //TODO: Remove after removed from dApp
          // response.alias_blockchain_id = isValidCAIP10Address(response.alias_address)
          //   ? convertCaipToObject(response.alias_address).result.chainId
          //   : null

          // response.alias_address = isValidCAIP10Address(response.alias_address)
          //   ? convertCaipToAddress(response.alias_address).result
          //   : response.alias_address

          response.aliases = aliases.map((alias) => ({
            ...alias,
            alias_blockchain_id: isValidCAIP10Address(alias.alias_address)
              ? convertCaipToObject(alias.alias_address).result.chainId
              : null
          }))

          // TODO: Remove after removed from frontend
          const firstAlias = aliases.length > 0 && aliases[0]

          if (firstAlias) {
            response.alias_blockchain_id = isValidCAIP10Address(firstAlias.alias_address)
              ? convertCaipToObject(firstAlias.alias_address).result.chainId
              : null

            response.alias_address = firstAlias
              ? isValidCAIP10Address(firstAlias.alias_address)
                ? convertCaipToAddress(firstAlias.alias_address).result
                : firstAlias.alias_address
              : null

            response.is_alias_verified = firstAlias ? firstAlias.is_verified : false

            response.alias_verification_event = firstAlias ? firstAlias.verification_event : null

            response.initiate_verification_proof = firstAlias
              ? firstAlias.initiate_verification_proof
              : null

            response.verify_verification_proof = firstAlias
              ? firstAlias.verify_verification_proof
              : null
          }

          const tagsService = Container.get(TagsService)
          response.tags = await tagsService.getTagsforResource(
            req.params.channelAddressinCAIP,
            TaggableTypes.Channel
          )

          return res.status(200).send(response)
        } else {
          return res.status(403).json('Error in verifying the channelAddress!')
        }
      } catch (error) {
        Logger.error('🔥 error in /v1/channels/:channelAddressinCAIP with error: %o', error)
        return next(error)
      }
    }
  )

  // Search channels by tags
  route.get(
    '/search/tags',
    celebrate({
      query: Joi.object({
        page: Joi.number().min(1).default(1),
        limit: Joi.number().default(10).min(1).max(30),
        order: Joi.string().default('desc').valid('asc', 'desc'),
        query: Joi.string()
      })
    }),
    async (req: Request, res: Response) => {
      const Logger: Logger = Container.get('logger')

      try {
        const tagsService = Container.get(TagsService)
        const channels = await tagsService.getTaggableResources(
          req.query.page,
          req.query.limit,
          req.query.order,
          req.query.query
        )
        return res.status(200).send({ channels: channels })
      } catch (error) {
        Logger.error('🔥 error in /v1/channels/search/tags endpoint : %o', error)
        return res.status(500).json(`🔥 error in /v1/channels/search/tags endpoint : ${error}`)
      }
    }
  )

  // Get channel tags
  route.get(
    '/:channelAddressinCAIP/tags',
    celebrate({
      params: Joi.object({
        channelAddressinCAIP: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const channels = Container.get(Channel)
        const { result: channelAddress, err } = convertCaipToAddress(
          req.params.channelAddressinCAIP
        )

        if (channelAddress && !err) {
          const response = await channels.getChannel(req.params.channelAddressinCAIP)
          if (!response) {
            return res.status(404).json('channel not found')
          }

          const tags = Container.get(TagsService)
          tags
            .getTagsforResource(response.channel, TaggableTypes.Channel)
            .then((result) => res.status(200).send(result))
            .catch((error) => res.status(500).json('Error in getting tags'))
        } else {
          return res.status(403).json('Error in verifying the channelAddress!')
        }
      } catch (error) {
        Logger.error('🔥 error in /v1/channels/:channelAddressinCAIP/tags with error: %o', error)
        return next(error)
      }
    }
  )

  route.get('/icon/:channel', async (req: Request, res: Response) => {
    const Logger: Logger = Container.get('logger')
    try {
      const channels = Container.get(Channel)
      const response = await channels.getChannelIcon(req.params.channel)
      if (!response) {
        return res.status(404).json('channel not found')
      }
      const matches = response.match(/^data:image\/(png|jpe?g);base64,(.+)/)
      const iconType = matches[1] // Image extension (png, jpg, or jpeg)
      const base64Content = matches[2] // Base64 image content
      res.setHeader('Content-Type', `image/${iconType}`)
      res.send(Buffer.from(base64Content, 'base64'))
    } catch (error) {
      Logger.error('🔥 error in /v1/channels/icon/:channel with error: %o', error)
      return res.status(500).json('Something went wrong')
    }
  })
}
