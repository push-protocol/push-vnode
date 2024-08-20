import { celebrate, errors, Joi } from 'celebrate'
import { NextFunction, Request, Response, Router } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'
import config from '../../config'
import { convertCaipToAddress } from '../../helpers/caipHelper'
import { AddPayloadRequest } from '../../services/messaging/msgConverterService'
import { ValidatorNode } from '../../services/messaging/validatorNode'
import middlewares from '../middlewares'
import StrUtil from '../../utilz/strUtil'
import IdUtil from '../../utilz/idUtil'
import { ValidatorRandom } from '../../services/messaging/validatorRandom'
import { ValidatorPing } from '../../services/messaging/validatorPing'
import { MessageBlock, PayloadItem, SenderType } from '../../services/messaging-common/messageBlock'
import { WinstonUtil } from '../../utilz/winstonUtil'
import jsonRouter from "express-json-rpc-router";
import {ValidatorRpc} from "./validatorRpc";
// /apis/v1/messaging
const route = Router()

const SOURCE_TYPE = config.supportedSourceTypes

// todo replace with interceptor (already existing)
function logRequestStarted(log: Logger, req: Request) {
  log.debug(`>>> Calling ${req.method} ${req.url} with body: %o`, req.body)
}

function logResponseFinished(log: Logger, status: number, responseObj: any) {
  log.debug(`=== Reply ${status} with body: %o`, responseObj)
}

function initRpc(app: Router) {
  const validatorRpc = Container.get(ValidatorRpc);
  app.use(`/v1/rpc`, jsonRouter({ methods: validatorRpc }));
}

export default (app: Router) => {
  initRpc(app);

  // Load the rest
  app.use(`/v1/messaging`, route)
  app.use(errors())

  // add external payload
  // todo: return number of items in the block
  route.post(
    '/addAsync',
    celebrate({
      body: Joi.object({
        id: Joi.string().optional(),
        verificationProof: Joi.string().required(),
        sender: Joi.string().required(),
        recipient: Joi.string().required(),
        source: Joi.string()
          .required()
          .valid(...SOURCE_TYPE),
        identity: Joi.string().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const log: Logger = Container.get('logger')
      logRequestStarted(log, req)
      try {
        const validatorNode = Container.get(ValidatorNode)
        const { result: recipient, err: recipientError } = convertCaipToAddress(req.body.recipient)
        const extPayload: AddPayloadRequest = req.body
        const requestId = StrUtil.getOrDefault(extPayload.id, IdUtil.getUuidV4())
        const p: PayloadItem = new PayloadItem(
          requestId,
          extPayload.verificationProof,
          extPayload.sender,
          SenderType.CHANNEL,
          'eip155:' + recipient,
          extPayload.source,
          extPayload.identity
        )
        const response = await validatorNode.addPayloadToMemPool(p)
        const code = response === true ? 200 : 400
        logResponseFinished(log, code, null)
        return res.status(code).send()
      } catch (e) {
        log.error('error: %o', e)
        return next(e)
      }
    }
  )

  // process cached block
  route.post(
    '/batchProcessBlock',
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const log: Logger = Container.get('logger')
      logRequestStarted(log, req)
      try {
        const validatorNode = Container.get(ValidatorNode)
        const response = await validatorNode.batchProcessBlock(false)
        const code = response == null ? 400 : 200
        logResponseFinished(log, code, response)
        return res.status(code).send(response)
      } catch (e) {
        log.error('error: %o', e)
        return next(e)
      }
    }
  )

  // for attestors: attest and add signatures
  route.post('/attest', async (req: Request, res: Response, next: NextFunction) => {
    const log: Logger = Container.get('logger')
    logRequestStarted(log, req)
    try {
      const messageBlock: MessageBlock = req.body
      const validatorNode = Container.get(ValidatorNode)
      const signatureArr = await validatorNode.attestBlock(messageBlock)
      const code = signatureArr == null ? 400 : 200
      logResponseFinished(log, code, signatureArr)
      return res.status(code).send(signatureArr)
    } catch (e) {
      log.error('error: %o', e)
      return next(e)
    }
  })

  route.post('/attestSignatures', async (req: Request, res: Response, next: NextFunction) => {
    return one(req, res, next, async () => {
      await Container.get(ValidatorNode).attestSignatures(req.body)
      return ''
    })
  })

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

  route.get('/validatorToken', async (req: Request, res: Response, next: NextFunction) => {
    return one(req, res, next, async () => {
      return await Container.get(ValidatorRandom).createValidatorToken()
    })
  })

  route.post(
    '/addWithToken',
    celebrate({
      body: Joi.object({
        id: Joi.string().optional(),
        verificationProof: Joi.string().required(),
        sender: Joi.string().required(),
        recipient: Joi.string().required(),
        source: Joi.string()
          .required()
          .valid(...SOURCE_TYPE),
        identity: Joi.string().required(),
        validatorToken: Joi.string().base64().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const log: Logger = Container.get('logger')
      logRequestStarted(log, req)
      try {
        const validatorNode = Container.get(ValidatorNode)
        const { result: recipient, err: recipientError } = convertCaipToAddress(req.body.recipient)
        const extPayload: AddPayloadRequest = req.body
        const requestId = StrUtil.getOrDefault(extPayload.id, IdUtil.getUuidV4())
        const p: PayloadItem = new PayloadItem(
          requestId,
          extPayload.verificationProof,
          extPayload.sender,
          SenderType.CHANNEL,
          'eip155:' + recipient,
          extPayload.source,
          extPayload.identity,
          extPayload.validatorToken
        )
        const response = await validatorNode.addPayloadToMemPool(p, true)
        const code = response === true ? 200 : 400
        logResponseFinished(log, code, null)
        return res.status(code).send()
      } catch (e) {
        log.error('error: %o', e)
        return next(e)
      }
    }
  )

  route.post(
    '/addBlocking',
    celebrate({
      body: Joi.object({
        id: Joi.string().optional(),
        verificationProof: Joi.string().required(),
        sender: Joi.string().required(),
        recipient: Joi.string().required(),
        source: Joi.string()
          .required()
          .valid(...SOURCE_TYPE),
        identity: Joi.string().required(),
        validatorToken: Joi.string().base64().required()
      })
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const log: Logger = Container.get('logger')
      logRequestStarted(log, req)
      try {
        const validatorNode = Container.get(ValidatorNode)
        const { result: recipient, err: recipientError } = convertCaipToAddress(req.body.recipient)
        const extPayload: AddPayloadRequest = req.body
        const requestId = StrUtil.getOrDefault(extPayload.id, IdUtil.getUuidV4())
        const p: PayloadItem = new PayloadItem(
          requestId,
          extPayload.verificationProof,
          extPayload.sender,
          SenderType.CHANNEL,
          'eip155:' + recipient,
          extPayload.source,
          extPayload.identity,
          extPayload.validatorToken
        )
        const response = await validatorNode.addPayloadToMemPoolBlocking(p)
        const code = response === true ? 200 : 400
        logResponseFinished(log, code, null)
        return res.status(code).send()
      } catch (e) {
        log.error('error: %o', e)
        return next(e)
      }
    }
  )

  // todo nsname is always 'inbox'
  route.get(
    '/ns/:nsName/nsidx/:nsIndex/date/:dt/key/:key',
    async (req: Request, res: Response, next: NextFunction) => {
      const log: Logger = WinstonUtil.newLog('validatorRoute')
      logRequestStarted(log, req)
      const nsName = req.params.nsName
      const nsIndex = req.params.nsIndex
      const dt = req.params.dt
      const key = req.params.key
      try {
        const validatorNode = Container.get(ValidatorNode)
        const response = await validatorNode.getRecord(nsName, nsIndex, dt, key)
        const code = response == null ? 500 : 200
        logResponseFinished(log, code, null)
        return res.status(code).send(response)
      } catch (e) {
        log.error('error: %o', e)
        return next(e)
      }
    }
  )

  // todo nsname is always 'inbox'
  route.get(
    '/ns/:nsName/nsidx/:nsIndex/month/:month/list/',
    async (req: Request, res: Response, next: NextFunction) => {
      const log: Logger = WinstonUtil.newLog('validatorRoute')
      logRequestStarted(log, req)
      const nsName = req.params.nsName
      const nsIndex = req.params.nsIndex
      const month = req.params.month
      const firstTs = req.query.firstTs
      try {
        const validatorNode = Container.get(ValidatorNode)
        const response = await validatorNode.listRecordsByMonth(nsName, nsIndex, month, firstTs)
        const code = response == null ? 500 : 200
        logResponseFinished(log, code, null)
        return res.status(code).send(response)
      } catch (e) {
        log.error('error: %o', e)
        return next(e)
      }
    }
  )

  route.get(
    '/settings/:channel/:chain',
    async (req: Request, res: Response, next: NextFunction) => {
      const log: Logger = WinstonUtil.newLog('validatorRoute')
      logRequestStarted(log, req)
      const channel = req.params.channel
      const chain = req.params.chain
      try {
        const validatorNode = Container.get(ValidatorNode)
        const response = await validatorNode.listSubscribers(channel, chain)
        const code = response == null ? 500 : 200
        logResponseFinished(log, code, null)
        return res.status(code).send(response)
      } catch (e) {
        log.error('error: %o', e)
        return next(e)
      }
    }
  )
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
