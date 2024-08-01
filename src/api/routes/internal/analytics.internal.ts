import { errors } from 'celebrate'
import { Router } from 'express'

const route = Router()

export default (app: Router) => {
  app.use('/analytics', route)
  app.use(errors())

  // LOAD INTERNAL ROUTES
}
