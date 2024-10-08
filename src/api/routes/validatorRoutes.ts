import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'
import { ValidatorRandom } from '../../services/messaging/validatorRandom'
import { ValidatorPing } from '../../services/messaging/validatorPing'

function logRequestStarted(log: Logger, req: Request) {
  log.debug(`>>> Calling ${req.method} ${req.url} with body: %o`, req.body)
}

function logResponseFinished(log: Logger, status: number, responseObj: any) {
  log.debug(`=== Reply ${status} with body: %o`, responseObj)
}


export function initMessaging (app: Router) {
  const route = Router()
  app.use(`/v1/messaging`, route)
  app.use(errors())

  route.get('/ping', async (req: Request, res: Response, next: NextFunction) => {
    return oneEx(req, res, next, false, async () => {
      return Container.get(ValidatorPing).ping()
    })
  })

  route.get('/pingState', async (req: Request, res: Response, next: NextFunction) => {
    return oneEx(req, res, next, false, async () => {
      return Array.from(Container.get(ValidatorPing).getPingState())
    })
  })

  route.get('/updatePingState', async (req: Request, res: Response, next: NextFunction) => {
    return one(req, res, next, async () => {
      await Container.get(ValidatorPing).updatePingState()
      return ''
    })
  })

  route.get('/random', async (req: Request, res: Response, next: NextFunction) => {
    return oneEx(req, res, next, false, async () => {
      return await Container.get(ValidatorRandom).nodeRandom()
    })
  })

  route.get('/updateNetworkRandom', async (req: Request, res: Response, next: NextFunction) => {
    return one(req, res, next, async () => {
      await Container.get(ValidatorRandom).updateNetworkRandom()
      return ''
    })
  })

  route.get('/networkRandomState', async (req: Request, res: Response, next: NextFunction) => {
    return one(req, res, next, async () => {
      return await Container.get(ValidatorRandom).getNetworkRandom()
    })
  })
}

async function one(req: Request, res: Response, next: NextFunction, returnOneObject: Function) {
  return oneEx(req, res, next, false, returnOneObject)
}

async function oneEx(
  req: Request,
  res: Response,
  next: NextFunction,
  logRequest: boolean,
  returnOneObject: Function
) {
  const log: Logger = Container.get('logger')
  try {
    if (logRequest) {
      logRequestStarted(log, req)
    }
    const result = await returnOneObject()
    const code = result == null ? 400 : 200
    if (logRequest) {
      logResponseFinished(log, code, result)
    }
    return res.status(code).send(result)
  } catch (e) {
    log.error('error : %o', e)
    return next(e)
  }
}
