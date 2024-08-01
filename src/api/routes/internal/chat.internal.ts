import { errors } from 'celebrate'
import { Router } from 'express'

const route = Router()

export default (app: Router) => {
  app.use('/chat', route)
  app.use(errors())

  // LOAD INTERNAL ROUTES
}
