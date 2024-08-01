import { celebrate, Joi } from 'celebrate'
import { Router } from 'express'
import { Container } from 'typedi'

import config from '../../../config'
import ChatService from '../../../services/chatService'
import chatInternal from '../internal/chat.internal'

const route = Router()
export default (app: Router) => {
  chatInternal(app)

  app.use(`/${config.api.version}/spaces`, route)
  const chatService = Container.get(ChatService)

  route.get(
    '/users/:did/spaces',
    celebrate({
      query: Joi.object({
        page: Joi.number().default(1).min(1),
        limit: Joi.number().default(10).min(1).max(30)
      })
    }),
    chatService.getSpacesPagination
  )

  route.get(
    '/users/:did/requests',
    celebrate({
      query: Joi.object({
        page: Joi.number().default(1).min(1),
        limit: Joi.number().default(10).min(1).max(30)
      })
    }),
    chatService.getSpacesRequestsPagination
  )

  route.get(
    '/trending',
    celebrate({
      query: Joi.object({
        page: Joi.number().default(1).min(1),
        limit: Joi.number().default(10).min(1).max(30)
      })
    }),
    chatService.getTrendingSpacesPagination
  )

  route.get('/users/:did/space/:recipient', chatService.getSpace)

  // Define the validation schema for searchSpaces route
  const searchSpacesSchema = {
    body: Joi.object({
      searchTerm: Joi.string().required(),
      pageNumber: Joi.number().integer().min(1).required(),
      pageSize: Joi.number().integer().min(1).required()
    })
  }
  // Route to search for spaces
  route.post(
    '/search',
    celebrate(searchSpacesSchema), // Validate the request body
    async (req, res) => {
      const { searchTerm, pageNumber, pageSize } = req.body
      try {
        const processedSpaces = await chatService.searchSpaces({
          searchTerm,
          pageNumber,
          pageSize
        })
        res.json(processedSpaces)
      } catch (error) {
        // Handle errors appropriately
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )
}
