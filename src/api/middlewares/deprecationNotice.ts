import { NextFunction, Request, Response } from 'express'

export const deprecationNotice = (deprecationDate: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const currentDate = new Date()
    const deprecationDateObj = new Date(deprecationDate)
    let noticeMessage = ''

    if (deprecationDateObj > currentDate) {
      noticeMessage = `This endpoint will be deprecated on ${deprecationDate}.`
    } else {
      noticeMessage = `This endpoint is deprecated since ${deprecationDate}.`
    }

    res.setHeader('X-DEPRECATION-NOTICE', noticeMessage)
    next()
  }
}
