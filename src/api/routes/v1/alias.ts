import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
const route = Router()
import { Logger } from 'winston'

import config from '../../../config'
import { convertCaipToAddress } from '../../../helpers/caipHelper'
import Channel from '../../../services/channelsCompositeClasses/channelsClass'
import aliasInternal from '../internal/alias.internal'
export default (app: Router) => {
  //load internal routes
  aliasInternal(app)

  // Load the actual external routes
  app.use(`/${config.api.version}/alias`, route)
  app.use(errors())
  // To get core address during channel alias verification
  route.get(
    '/:aliasAddressinCAIP/channel',
    celebrate({
      params: Joi.object({
        aliasAddressinCAIP: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const Logger: Logger = Container.get('logger')
      const { result: aliasAddress, err } = convertCaipToAddress(req.params.aliasAddressinCAIP)
      try {
        const channels = Container.get(Channel)
        if (!err) {
          const response = await channels.getAliasDetails(req.params.aliasAddressinCAIP)
          if (response) {
            response.channel = convertCaipToAddress(response.channel).result
            response.alias_address = convertCaipToAddress(response.alias_address).result
          }
          return res.status(200).send(response ?? {})
        } else {
          return res.status(403).send(err)
        }
      } catch (error) {
        Logger.error('🔥 error in /v1/alias/:aliasAddressinCAIP/channel endpoint: %o', error)
        return next(error)
      }
    }
  )
}
