import { NextFunction, Request, Response } from 'express'

const notFoundMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.sendStatus(404)
}

export default notFoundMiddleware
