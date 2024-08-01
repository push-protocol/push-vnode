import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'

import config from '../../../config'
import {
  convertAddressToCaip,
  convertAddressToPartialCaip,
  convertCaipToAddress,
  isValidCAIP10Address
} from '../../../helpers/caipHelper'
import * as caipHelper from '../../../helpers/caipHelper'
import Alias from '../../../services/channelsCompositeClasses/aliasClass'
import Channel from '../../../services/channelsCompositeClasses/channelsClass'
import Subscribers from '../../../services/channelsCompositeClasses/subscribersClass'
import ChannelsService from '../../../services/channelsService'
import { validateAddress } from '../../helpers/joiHelper'
import middlewares from '../../middlewares'
import { deprecationNotice } from '../../middlewares/deprecationNotice'

const route = Router()

const BLOCKCHAIN = config.MAP_ID_TO_BLOCKCHAIN

export default (app: Router) => {
  // Load all deprecated routes
  app.use('/channels', route)
  app.use(errors())

  // LOAD DEPRECATED ROUTES
  // DEPRECATED BUT PRESENT AS IT'S USED IN SDK
  route.post(
    '/subscribe_offchain',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        signature: Joi.string().required(),
        message: Joi.object().required(),
        contractAddress: Joi.string().required(),
        chainId: Joi.number().required(),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'write')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/subscribe_offchain endpoint with body: %o', req.body)
      try {
        const channels = Container.get(ChannelsService)
        const verificationStatus = await channels.addExternalSubscribers(
          `eip712:${req.body.signature}`,
          req.body.message,
          req.body.chainId,
          'eip712'
        )
        if (verificationStatus) return res.status(204).json()
        else return res.status(403).json('Error in verifying the signature!')
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  // DEPRECATED BUT PRESENT AS IT'S USED IN SDK
  route.post(
    '/unsubscribe_offchain',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        signature: Joi.string().required(),
        message: Joi.object().required(),
        contractAddress: Joi.string().required(),
        chainId: Joi.number().required(),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'write')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/unsubscribe_offchain endpoint with body: %o', req.body)
      try {
        const channels = Container.get(ChannelsService)
        const verificationStatus = await channels.removeExternalSubscribers(
          `eip712:${req.body.signature}`,
          req.body.message,
          req.body.chainId,
          'eip712'
        )
        if (verificationStatus) return res.status(204).json()
        else return res.status(403).json('Error in verifying the signature!')
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  // ALL POST ROUTES WITHOUT VERSIONING
  // Get list of all the channels delegated to the user, deprecated -> use /users/:caipAddress/delegations
  route.get(
    '/_getUserDelegations/:userAddressinCAIP',
    deprecationNotice('2024-01-01'),
    celebrate({
      params: Joi.object({
        userAddressinCAIP: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/getUserDelegations endpoint with body: %o', req.params)

      try {
        const channels = Container.get(Channel)
        const response = await channels.getChannelOwnersFromDelegate(req.params.userAddressinCAIP)
        response.channelOwners = caipHelper.batchConvertCaipToAddresses(response.channelOwners)
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
        return next(error)
      }
    }
  )

  // to fetch the equivalent PUSH price for DAI
  route.post(
    '/getDaiToPush',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        value: Joi.number().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/getDaiToPush endpoint with body: %o', req.body)
      const rp = require('request-promise')
      try {
        const channels = Container.get(ChannelsService)
        const requestOptions = {
          method: 'GET',
          uri: 'https://pro-api.coinmarketcap.com/v1/tools/price-conversion',
          qs: {
            amount: req.body.value,
            symbol: 'DAI',
            convert: 'PUSH'
          },
          headers: {
            'X-CMC_PRO_API_KEY': 'e80dd2de-59b5-4f00-9c1d-93a214390481'
          },
          json: true,
          gzip: true
        }
        rp(requestOptions)
          .then((response) => {
            return res.status(201).json({ response })
          })
          .catch((err) => {
            return res.status(500).json({ response: 'Internal Server Error' })
          })
      } catch (e) {
        Logger.error(':fire: error: %o', e)
        return next(e)
      }
    }
  )

  route.post(
    '/_search',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        address: Joi.string().default('None'),
        chainId: Joi.number().default(config.ethereumChainId),
        query: Joi.string().required(),
        page: Joi.number().required(), // 1-indexed; not 0-indexed
        pageSize: Joi.number().required(),
        op: 'read'
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'read')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/search endpoint with body: %o', req.body)

      try {
        const channels = Container.get(ChannelsService)
        const address = validateAddress(req.body.address)
          ? convertAddressToCaip(req.body.channel, req.body.chainId).result
          : req.body.address
        const response = await channels.searchChannelDetail(
          req.body.query,
          address,
          req.body.chainId,
          req.body.page,
          req.body.pageSize
        )
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  // to get verification status for alias
  // !!!IMPORTANT -- DEPRECTAED!!!!
  route.post(
    '/_getAliasVerification',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        aliasAddress: Joi.string().required().custom(validateAddress),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'read')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/getAliasVerification endpoint with body: %o', req.body)

      try {
        const alias = Container.get(Alias)
        const aliasAddress = convertAddressToCaip(
          req.body.aliasAddress,
          config.polygonChainId
        ).result
        const response = await alias.isAliasVerified(aliasAddress)
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )
  // END ALL POST ROUTES WITHOUT VERSIONING

  // Get status of a single user
  route.post(
    '/_is_user_subscribed',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        channel: Joi.string().required().custom(validateAddress),
        subscriber: Joi.string().required().custom(validateAddress),
        blockchain: Joi.string().default(config.supportedSourceTypes[0]),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'read')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_is_user_subscribed endpoint with body: %o', req.body)

      try {
        const subscribers = Container.get(Subscribers)
        const channel = convertAddressToCaip(
          req.body.channel,
          config.MAP_BLOCKCHAIN_STRING_TO_ID[req.body.blockchain]
        ).result
        const subscriber = convertAddressToPartialCaip(req.body.subscriber).result
        const response = await subscribers.isUserSubscribed(
          channel,
          subscriber,
          req.body.blockchain
        )
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  // To get all subscriber from a channel
  route.post(
    '/_get_subscribers',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        //TODO: Add required in blockchain
        channel: Joi.string().required().custom(validateAddress),
        blockchain: Joi.number().default(config.ethereumChainId),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'read')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_get_subscribers endpoint with body: %o', req.body)
      try {
        const channels = Container.get(Subscribers)
        const channel = convertAddressToCaip(req.body.channel, req.body.blockchain).result
        const { success, subscribers } = await channels.getSubscribers(channel, req.body.blockchain)
        const subscribersInNonCaip = caipHelper.batchConvertCaipToAddresses(subscribers)
        return res.status(200).json({ success, subscribers: subscribersInNonCaip })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // To get all subscriber from a channel
  route.post(
    '/get_subscribers',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        //TODO: Add required in blockchain
        channel: Joi.string().required().custom(validateAddress),
        blockchain: Joi.number().default(config.ethereumChainId),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      await middlewares.onlyAuthorizedSimple(req, res, next, 'read')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_get_subscribers endpoint with body: %o', req.body)
      try {
        const channels = Container.get(Subscribers)
        const channel = convertAddressToCaip(req.body.channel, req.body.blockchain).result
        const { success, subscribers } = await channels.getSubscribers(channel, req.body.blockchain)
        const subscribersInNonCaip = caipHelper.batchConvertCaipToAddresses(subscribers)
        return res.status(200).json({ success, subscribers: subscribersInNonCaip })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // @desc      Get All channels with pagination
  // @body      page,pageSize,op
  // @route     POST /apis/channels/fetch_channels
  // @access    Public
  route.post(
    '/_fetch_channels',
    deprecationNotice('2024-01-01'),
    celebrate({
      body: Joi.object({
        page: Joi.number().required(),
        pageSize: Joi.number().required(),
        op: Joi.string().required()
      })
    }),
    async (req, res, next) => {
      // TODO: change it to "read"
      await middlewares.onlyAuthorizedSimple(req, res, next, 'write')
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_fetch_channels endpoint with body: %o', req.body.user)

      try {
        const channels = Container.get(Channel)
        const response = await channels.getChannels(req.body.page, req.body.pageSize)
        response.results.map((each) => {
          each.channel = convertCaipToAddress(each.channel).result
          each.alias_address = isValidCAIP10Address(each.alias_address)
            ? convertCaipToAddress(each.alias_address).result
            : each.alias_address
        })
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )
}
