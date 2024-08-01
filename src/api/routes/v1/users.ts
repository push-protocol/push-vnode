import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'

import UsersService from '../../../services/usersService'
const route = Router()
import { Logger } from 'winston'

import config from '../../../config'
import { convertAddressToPartialCaip, convertCaipToAddress } from '../../../helpers/caipHelper'
import { isAddressAlias, isValidCAIP10Address } from '../../../helpers/caipHelper'
import ChannelsService from '../../../services/channelsService'
import FeedsService from '../../../services/feedsService'
import usersDeprecated from '../deprecated/users.deprecated'
import usersInternal from '../internal/users.internal'
export default (app: Router) => {
  // load internal routes
  usersInternal(app)
  usersDeprecated(app)
  // Load the actual external routes
  app.use(`/${config.api.version}/users`, route)
  app.use(errors())

  // Get list of all subscriptions of the the user
  route.get(
    '/:userAddressInCAIP/subscriptions',
    celebrate({
      params: Joi.object({
        userAddressInCAIP: Joi.string().required()
      }),
      query: Joi.object({
        channel: Joi.string().optional()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const { result: userAddress, err } = convertCaipToAddress(req.params.userAddressInCAIP)

        if (!err) {
          const users = Container.get(UsersService)
          const partialCAIPUserAddress = convertAddressToPartialCaip(userAddress).result
          const response = await users.getSubscribedChannels(partialCAIPUserAddress)
          response.subscriptions.map(
            (each) =>
              (each.channel = isValidCAIP10Address(each.channel)
                ? convertCaipToAddress(each.channel).result
                : each.channel)
          )
          if (req.query.channel && req.query.channel != 'null' && req.query.channel.length != 0) {
            let flag = false
            for (let i = 0; i < response.subscriptions.length; i++) {
              if (
                req.query.channel
                  .toLowerCase()
                  .includes(response.subscriptions[i].channel.toLowerCase())
              ) {
                flag = true
                response.subscriptions = [response.subscriptions[i]]
              }
            }
            if (!flag) {
              response.subscriptions = []
            }
          }
          return res.status(200).send(response)
        } else {
          return res.status(403).send(err)
        }
      } catch (error) {
        Logger.error(
          '🔥 Error in calling /users/:userAddressInCAIP/subscriptions/ endpoint with error: %o',
          error
        )
        return next(error)
      }
    }
  )

  // Get list of all delegations to the users
  route.get(
    '/:userAddressInCAIP/delegations',
    celebrate({
      params: Joi.object({
        userAddressInCAIP: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const { result: userAddress, err } = convertCaipToAddress(req.params.userAddressInCAIP)

        if (!err) {
          const users = Container.get(UsersService)
          const response = await users.getDelegatedChannels(req.params.userAddressInCAIP)
          response.delegations.map(
            (each) =>
              (each.channel = isValidCAIP10Address(each.channel)
                ? convertCaipToAddress(each.channel).result
                : each.channel)
          )
          return res.status(200).send(response)
        } else {
          return res.status(403).send(err)
        }
      } catch (error) {
        Logger.error(
          '🔥 Error in calling /users/:userAddressInCAIP/delegations/ endpoint with error: %o',
          error
        )
        return next(error)
      }
    }
  )

  // @desc      Get Feeds for a particular user with pagination
  // @body      user,page,pageSize,op
  // @route     POST /apis/feeds/get_feeds
  // @access    Public
  route.get(
    ['/:userAddressinCAIP/feeds', '/:userAddressinCAIP/notifications'],
    celebrate({
      params: Joi.object({
        userAddressinCAIP: Joi.string().required()
      }),
      query: Joi.object({
        page: Joi.number().default(1).min(1),
        limit: Joi.number().default(10).min(1),
        // .max(30),
        spam: Joi.boolean().default(false),
        showHidden: Joi.boolean().default(false)
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const feeds = Container.get(FeedsService)
        const { result: userAddress, err } = convertCaipToAddress(req.params.userAddressinCAIP)
        if (userAddress && !err) {
          const response = !req.query.spam
            ? await feeds.getFeeds(
                convertAddressToPartialCaip(userAddress).result,
                req.query.page,
                req.query.limit,
                req.query.showHidden
              )
            : await feeds.getSpamFeeds(
                convertAddressToPartialCaip(userAddress).result,
                req.query.page,
                req.query.limit,
                req.query.showHidden
              )
          response.feeds.map(
            (each) =>
              (each.sender = isValidCAIP10Address(each.sender)
                ? convertCaipToAddress(each.sender).result
                : each.sender)
          )
          return res.status(200).send(response)
        } else {
          return next(err)
        }
      } catch (error) {
        Logger.error('🔥 error: %o', error)
        return next(error)
      }
    }
  )

  // @desc      Get Unique Channels where the user has spam messages
  // @access    Public
  route.get(
    ['/:userAddressinCAIP/spam/channels'],
    celebrate({
      params: Joi.object({
        userAddressinCAIP: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const feeds = Container.get(FeedsService)
        const { result: userAddress, err } = convertCaipToAddress(req.params.userAddressinCAIP)
        if (userAddress && !err) {
          const response = await feeds.getUniqueSpamChannels(
            convertAddressToPartialCaip(userAddress).result
          )

          const channels = []
          const aliases = []

          response.forEach((address) => {
            if (isAddressAlias(address)) {
              aliases.push(address)
            } else {
              channels.push(address)
            }
          })

          const channelsService = Container.get(ChannelsService)

          const aliasResponse = await channelsService.getChannelsByAliasAddresses(aliases)
          const channelResponse = await channelsService.getChannelsByChannelAddress(channels)

          const combinedResponse = []

          // Add all the data from aliasResponse
          for (const alias of aliasResponse) {
            combinedResponse.push({
              channel: alias.channel,
              alias_address: alias.alias_address === 'NULL' ? null : alias.alias_address
            })
          }

          // Add all the data from channelResponse
          for (const channel of channelResponse) {
            combinedResponse.push({
              channel: channel.channel,
              alias_address: channel.alias_address === 'NULL' ? null : channel.alias_address
            })
          }

          const uniqueResponse = combinedResponse.reduce((accumulator, current) => {
            if (accumulator.findIndex((item) => item.channel === current.channel) < 0) {
              accumulator.push(current)
            }
            return accumulator
          }, [])

          return res.status(200).send(uniqueResponse)
        } else {
          return next(err)
        }
      } catch (error) {
        Logger.error('🔥 error: %o', error)
        return next(error)
      }
    }
  )

  // @desc      Get Feeds for a particular user from a given channel with pagination
  // @body      user,page,pageSize,op
  // @route     POST /apis/feeds/get_feeds
  // @access    Public
  route.get(
    [
      '/:userAddressinCAIP/channels/:channelAddressinCAIP/feeds',
      '/:userAddressinCAIP/channels/:channelAddressinCAIP/notifications'
    ],
    celebrate({
      params: Joi.object({
        userAddressinCAIP: Joi.string().required(),
        channelAddressinCAIP: Joi.string().required()
      }),
      query: Joi.object({
        page: Joi.number().default(1).min(1),
        limit: Joi.number().default(10).min(1),
        // .max(30),
        spam: Joi.boolean().default(false)
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      try {
        const feeds = Container.get(FeedsService)
        const { result: userAddress, err } = convertCaipToAddress(req.params.userAddressinCAIP)
        const { result: channelAddress, err2 } = convertCaipToAddress(
          req.params.channelAddressinCAIP
        )
        if (userAddress && !err && channelAddress && !err2) {
          const response = !req.query.spam
            ? await feeds.getChannelFeeds(
                convertAddressToPartialCaip(userAddress).result,
                req.params.channelAddressinCAIP,
                req.query.page,
                req.query.limit
              )
            : await feeds.getChannelSpamFeeds(
                convertAddressToPartialCaip(userAddress).result,
                req.params.channelAddressinCAIP,
                req.query.page,
                req.query.limit
              )

          response.feeds.map(
            (each) =>
              (each.sender = isValidCAIP10Address(each.sender)
                ? convertCaipToAddress(each.sender).result
                : each.sender)
          )
          return res.status(200).send(response)
        } else {
          return next(err)
        }
      } catch (error) {
        Logger.error('🔥 error: %o', error)
        return next(error)
      }
    }
  )
}
