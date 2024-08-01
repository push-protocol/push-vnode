import { Router } from 'express'

import loggerMiddleware from './middlewares/loggerMiddleware'
import notFoundMiddleware from './middlewares/notFoundMiddleware'
import alias from './routes/v1/alias'
import channels from './routes/v1/channels'
import encryptionKeys from './routes/v1/encryptionKeys'
import feeds from './routes/v1/feeds'
import historyfetcher from './routes/v1/historyfetcher'
import internals from './routes/v1/internals'
import payloads from './routes/v1/payloads'
import auth from './routes/v1/auth'
import analytics from './routes/v1/analytics'
import apikeys from './routes/v1/apikeys'
import ipfs from './routes/v1/ipfs'
import mailing from './routes/v1/mailing'
import chat from './routes/v1/chat'
import spaces from './routes/v1/spaces'
import pushtokens from './routes/v1/pushtokens'
import turnserver from './routes/v1/turnserver'
import { initValidatorRoutes } from '../services/messaging/validatorRoutesLoader'
import { EnvLoader } from '../utilz/envLoader'
import { ExpressUtil } from '../utilz/expressUtil'
import users from './routes/v1/users'
import w2w from './routes/v1/w2w'
import channelsV2 from './routes/v2/channels'
import chatV2 from './routes/v2/chat'
import usersV2 from './routes/v2/users'
import socketWeb3 from './sockets/socketWeb3'

// guaranteed to get dependencies
export default () => {
  const app = Router()
  // -- SERVICES ROUTES - PRIORTIZE

  // VALIDATOR LOGIC
  if (EnvLoader.getPropertyAsBool('VALIDATOR_HTTP_LOG')) {
    app.use(ExpressUtil.handle)
  } else {
    app.use(loggerMiddleware)
  }
  initValidatorRoutes(app)
  if (EnvLoader.getPropertyAsBool('VALIDATOR_DISABLE_ALL_SERVICES')) {
    app.use(notFoundMiddleware)
    return app
  }
  // VALIDATOR LOGIC END

  // For W2W Chat
  users(app)

  usersV2(app)

  // For Chat
  w2w(app)

  chat(app)

  chatV2(app)

  spaces(app)

  apikeys(app)

  auth(app)

  analytics(app)

  // For feeds route
  feeds(app)

  // For IPFS local node
  ipfs(app)

  // For channels route
  channels(app)

  channelsV2(app)

  // -- SOCKETS
  socketWeb3()

  // alias route
  alias(app)

  // For payloads route -- handling all payload sent
  payloads(app)

  // For internal route -- all internal
  pushtokens(app)

  // For mailing route -- deprecated but used to send mail
  mailing(app)

  // For encryptionKeys route
  encryptionKeys(app)

  // For history fetcher route -- all internal
  historyfetcher(app)

  // For internal route -- all internal
  internals(app)

  //for turnserver ice config
  turnserver(app)

  app.use(notFoundMiddleware)

  // Finally return app
  return app
}
