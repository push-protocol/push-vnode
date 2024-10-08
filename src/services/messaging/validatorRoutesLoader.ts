import messaging from '../../api/routes/validatorRoutes'
import dset from '../messaging-dset/dsetRoutes'
import * as core from 'express-serve-static-core'
import {EnvLoader} from "../../utilz/envLoader";
import {ExpressUtil} from "../../utilz/expressUtil";

export async function initValidatorRoutes(app: core.Router) {
  if (EnvLoader.getPropertyAsBool('VALIDATOR_HTTP_LOG')) {
    app.use(ExpressUtil.handle)
  }
  // validators
  messaging(app)
  dset(app)
}
