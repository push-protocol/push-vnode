import { celebrate, Joi } from 'celebrate'
import { Router } from 'express'
import { Container } from 'typedi'

import config from '../../../config'
import IPFSService from '../../../services/ipfsService'
import ipfsInternal from '../internal/ipfs.internal'

const route = Router()
export default (app: Router) => {
  //load internal routes
  ipfsInternal(app)

  app.use(`/${config.api.version}/ipfs`, route)
  const ipfsService = Container.get(IPFSService)

  route.get('/:cid', ipfsService.getIPFS)

  route.post(
    '/upload',
    celebrate({
      body: Joi.object({
        data: Joi.string().required()
      })
    }),
    ipfsService.uploadToIPFS
  )
}
