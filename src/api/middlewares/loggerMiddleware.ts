import { NextFunction, Request, Response } from 'express'
import { Container } from 'typedi'
import { Logger } from 'winston'

const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const oldWrite = res.write
  const oldEnd = res.end

  const chunks = []

  res.write = (...restArgs) => {
    chunks.push(Buffer.from(restArgs[0]))
    oldWrite.apply(res, restArgs)
  }

  res.end = (...restArgs) => {
    if (restArgs[0]) {
      chunks.push(Buffer.from(restArgs[0]))
    }
    const body = Buffer.concat(chunks).toString('utf8')

    const Logger: Logger = Container.get('logger')
    Logger.debug(
      `Calling ${req.method} ${req.url} with \n body: %o \n query: %o \n params: %o `,
      req?.body,
      req?.query,
      req?.params
    )

    // console.log(body);
    oldEnd.apply(res, restArgs)
  }

  next()
}

export default loggerMiddleware
