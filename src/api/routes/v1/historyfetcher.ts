import { errors } from 'celebrate'
import { Router } from 'express'

import historyFetcherInternal from '../internal/historyfetcher.internal'

const route = Router()

export default (app: Router) => {
  // load internal routes
  historyFetcherInternal(app)

  // Load the actual external routes
  app.use('/historyfetcher', route)
  app.use(errors())
}
