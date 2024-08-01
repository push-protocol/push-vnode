import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'

import config from '../../../config'
import Alias from '../../../services/channelsCompositeClasses/aliasClass'
import Channel from '../../../services/channelsCompositeClasses/channelsClass'
import ChannelsService from '../../../services/channelsService'
import { validateAddress } from '../../helpers/joiHelper'
import middlewares from '../../middlewares'

const route = Router()

export default (app: Router) => {
  app.use('/channels', route)
  app.use(errors())

  // LOAD INTERNAL ROUTES
  // to get a channel info
  route.post(
    '/_get',
    celebrate({
      body: Joi.object({
        channel: Joi.string().required().custom(validateAddress)
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_info endpoint with body: %o', req.body)
      try {
        const channels = Container.get(Channel)
        const response = await channels.getChannel(req.body.channel)
        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to add a channel info
  route.post(
    '/_add',
    celebrate({
      body: Joi.object({
        channel: Joi.string().required().custom(validateAddress),
        channelType: Joi.number().required(),
        identity: Joi.string().required()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_add endpoint with body: %o', req.body)
      try {
        const channels = Container.get(Channel)
        const { response } = await channels.addChannel(
          req.body.channel,
          req.body.channelType,
          req.body.identity
        )

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to update a channel info
  route.post(
    '/_update',
    celebrate({
      body: Joi.object({
        channel: Joi.string().required().custom(validateAddress),
        identity: Joi.string().required()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_update endpoint with body: %o', req.body)
      try {
        const channels = Container.get(Channel)
        const { response } = await channels.updateChannel(req.body.channel, req.body.identity)

        return res.status(201).json(response)
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to process a selected channel for retrieving info
  route.post(
    '/_process_channel_data',
    celebrate({
      body: Joi.object({
        channel: Joi.string().required().custom(validateAddress),
        ipfshash: Joi.string().required()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_process_channel_data endpoint with body: %o', req.body)
      try {
        const channels = Container.get(Channel)
        const { success, name, info, url, icon, iconV2 } = await channels.processChannelData(
          req.body.channel,
          req.body.ipfshash
        )

        return res.status(201).json({ success, name, info, url, icon, iconV2 })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  // to batch process the entire channels db for retrieving info
  route.post(
    '/_batch_process_channels_data',
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_batch_process_channels_data endpoint with body: %o', req.body)
      try {
        const channels = Container.get(Channel)
        const { success, channel, ipfshash } = await channels.batchProcessChannelData()

        return res.status(204).json()
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )

  route.post(
    '/_check_update_alias',
    celebrate({
      body: Joi.object({
        ethAddress: Joi.string().required().custom(validateAddress),
        aliasAddress: Joi.string().required().custom(validateAddress),
        aliasChainId: Joi.number().required(),
        op: Joi.string().required()
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_check_update_alias endpoint with body: %o', req.body)

      try {
        const alias = Container.get(Alias)
        const response = await alias.checkAndUpdateAlias(
          req.body.ethAddress,
          req.body.aliasAddress,
          req.body.aliasChainId,
          req.body.verificationProof
        )
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  route.post(
    '/_batch_process_alias',
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_batch_process_alia endpoint with body: %o', req.body)

      try {
        const channels = Container.get(ChannelsService)
        const response = await channels.batchProcessAliasVerificationData()
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  route.post(
    '/_delegatee/add_delegate',
    celebrate({
      body: Joi.object({
        channelAddress: Joi.string().required().custom(validateAddress),
        delegateeAddress: Joi.string().required().custom(validateAddress),
        blockchain: Joi.string().default(config.ethereumId)
      })
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_delegatee/add_delegate endpoint with body: %o', req.body)

      try {
        const channels = Container.get(Channel)
        const response = await channels.setDelegateeAddress(
          req.body.channelAddress,
          req.body.delegateeAddress,
          req.body.blockchain
        )
        return res.status(200).send(response)
      } catch (error) {
        Logger.error('🔥 error: %o', error)
      }
    }
  )

  route.post(
    '/_get_all_subgraph',
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger = Container.get('logger')
      Logger.debug('Calling /channel/_get_all_subgraph endpoint with body: %o', req.body)
      try {
        const channels = Container.get(Channel)
        const response = await channels.getAllSubGraphDetails()

        return res.status(201).json({ result: response })
      } catch (e) {
        Logger.error('🔥 error: %o', e)
        return next(e)
      }
    }
  )
}
