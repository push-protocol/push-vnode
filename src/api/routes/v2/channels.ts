import { celebrate, errors, Joi } from 'celebrate'
import { Request, Response, Router } from 'express'
import { Container } from 'typedi'

import ChannelPrecache from '../../../services/channelsCompositeClasses/precacheChannel'
import FeedsService from '../../../services/feedsService'

const route = Router()
export default (app: Router) => {
  app.use(`/v2/channels`, route)
  app.use(errors())

  const feedService = Container.get(FeedsService)
  const channelPrecahce = Container.get(ChannelPrecache)

  route.get(
    '/:channel/notifications',
    celebrate({
      params: Joi.object({
        /* Channel address in CAIP format */
        channel: Joi.string().required()
      }),
      query: Joi.object({
        page: Joi.number().min(1).default(1),
        limit: Joi.number().default(10).min(1).max(30),
        /* 1 -> Broadcast | 3 -> target | 4 -> subset */
        notificationType: Joi.number().valid(1, 3, 4),
        raw: Joi.boolean().default(false)
      })
    }),
    feedService.getFeedsOfChannelV2
  )

  route.post(
    '/precache/:channel',
    celebrate({
      params: Joi.object({
        channel: Joi.string().required()
      }),
      body: Joi.object({
        channelMetaVerificationProof: Joi.string().required(),
        channelMeta: Joi.object({
          name: Joi.string().required(),
          info: Joi.string().required(),
          icon: Joi.string().required(),
          url: Joi.string().required(),
          aliasDetails: Joi.object().optional()
        })
      })
    }),
    async (req: Request, res: Response) => {
      try {
        const channelPrecahce = Container.get(ChannelPrecache)
        const result = await channelPrecahce.addChannelMeta({
          channel: req.params.channel,
          channelMetaVerificationProof: req.body.channelMetaVerificationProof,
          channelMeta: req.body.channelMeta
        })
        if (result) {
          return res.status(201)
        } else {
          return res.status(403)
        }
      } catch (error) {
        res.status(500)
      }
    }
  )
}
