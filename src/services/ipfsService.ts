import { NextFunction, Request, Response } from 'express'
import { Service } from 'typedi'
import { Container } from 'typedi'
import { Logger } from 'winston'

import { getMessageByReference, getReferenceFromThreadhash, uploadToIPFS } from '../db-access/w2w'
import { getSizeInBytes } from '../helpers/chatHelper'

@Service()
export default class IPFSService {
  /**
   * @dev - This fn does not return any data from IPFS but cannot be changed due to backward compatibility issues
   */
  public async getIPFS(req: Request, res: Response): Promise<Response> {
    try {
      const threadhash = req.params.cid as `v2:${string}` | `previous:v2:${string}`
      const reference = await getReferenceFromThreadhash(threadhash)
      const message = await getMessageByReference(reference)
      return res.status(200).send(message)
    } catch (err) {
      const logger: Logger = Container.get('logger')
      logger.error('🔥 error: Error when fetching by reference')
      return res.status(400).send('Error when fetching by reference')
    }
  }

  public async uploadToIPFS(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const data: string = req.body.data as string
      if (!data) {
        return res.send(400).send('Invalid request body')
      }
      const messageSizeInBytes: number = getSizeInBytes(data)
      if (messageSizeInBytes / (1024 * 1024) > 2) {
        return res.status(400).send('Message paylaod is over the maximum limit')
      }
      const { cid } = await uploadToIPFS(data)
      return res.status(201).json({ cid: cid.toString() })
    } catch (e) {
      const logger: Logger = Container.get('logger')
      logger.error('🔥 error: %o', e)
      return next(e)
    }
  }
}
