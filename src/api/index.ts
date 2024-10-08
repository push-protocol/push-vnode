import {Application, Router} from 'express'
import { EnvLoader } from '../utilz/envLoader'
import { ExpressUtil } from '../utilz/expressUtil'
import * as messaging from './routes/validatorRoutes'
import * as core from 'express-serve-static-core'
import {initMessaging} from "./routes/validatorRoutes";
import {Container} from "typedi";
import {ValidatorRpc} from "./routes/validatorRpc";
import jsonRouter from "express-json-rpc-router";


export function initRoutes (app: Application) {
  if (EnvLoader.getPropertyAsBool('VALIDATOR_HTTP_LOG')) {
    app.use(ExpressUtil.handle)
  }
  initMessaging(app);
  initRpc(app);
  // app.use(notFoundMiddleware)
  return app;
}

function initRpc(app: Router) {
  const validatorRpc = Container.get(ValidatorRpc);
  app.use(`/v1/rpc`, jsonRouter({ methods: validatorRpc }));
}
