import { NextFunction, Request, Response } from 'express'

import config from '../../config'
import { client as redisClient } from '../../loaders/redis'
const syncStatusMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const syncStatus = await redisClient.get(config.syncStatus)
    if (syncStatus) {
      if (JSON.parse(syncStatus)) next()
      else res.sendStatus(409)
    } else {
      // incase of issue with fetching sync status, continue accepting request
      next()
    }
  } catch (error) {
    // in case of error, do not block the api
    next()
  }
}

export default syncStatusMiddleware
