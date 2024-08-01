import messaging from '../../api/routes/validatorRoutes'
import dset from '../messaging-dset/dsetRoutes'
import * as core from 'express-serve-static-core'

export async function initValidatorRoutes(app: core.Router) {
  // validators
  messaging(app)
  dset(app)
}
