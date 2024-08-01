import { errors } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'
import config from '../../config'
import { QueueManager } from '../messaging/QueueManager'
import { NumUtil } from '../../utilz/numUtil'

const route = Router()
const SOURCE_TYPE = config.supportedSourceTypes

function logRequestStarted(log: Logger, req: Request) {
  log.debug(`>>> Calling ${req.method} ${req.url} with body: %o`, req.body)
}

function logResponseFinished(log: Logger, status: number, responseObj: any) {
  log.debug(`=== Reply ${status} with body: %o`, responseObj)
}

export default (app: Router) => {
  // Load the rest
  app.use(`/${config.api.version}/dset`, route)
  app.use(errors())

  route.get('/pollRemoteQueues', async (req: Request, res: Response, next: NextFunction) => {
    return one(req, res, next, async () => {
      return await Container.get(QueueManager).pollRemoteQueues()
    })
  })

  route.get('/queue/:queueName', async (req: Request, res: Response, next: NextFunction) => {
    return one(req, res, next, async () => {
      const queueName = req.params.queueName
      const firstOffset = NumUtil.parseInt(req.query.firstOffset, 0)
      return await Container.get(QueueManager).readItems(queueName, firstOffset)
    })
  })

  route.get(
    '/queue/:queueName/lastOffset',
    async (req: Request, res: Response, next: NextFunction) => {
      return one(req, res, next, async () => {
        const queueName = req.params.queueName
        return await Container.get(QueueManager).getQueueLastOffset(queueName)
      })
    }
  )
}

async function one(req: Request, res: Response, next: NextFunction, returnOneObject: Function) {
  const log: Logger = Container.get('logger')
  try {
    logRequestStarted(log, req)
    const result = await returnOneObject()
    const code = result == null ? 400 : 200
    logResponseFinished(log, code, result)
    return res.status(code).send(result)
  } catch (e) {
    log.error('error : %o', e)
    return next(e)
  }
}
