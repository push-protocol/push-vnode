import { Inject, Service } from 'typedi'

import { EventDispatcher, EventDispatcherInterface } from '../decorators/eventDispatcher'

const db = require('../helpers/dbHelper')

@Service()
export default class PushTokensService {
  constructor(
    @Inject('logger') private logger,
    @EventDispatcher() private eventDispatcher: EventDispatcherInterface
  ) {}

  public async registerDevice(
    wallet: string,
    device_token_decrypted: string,
    platform_decrypted: string
  ) {
    const logger = this.logger
    logger.debug('Registering device')

    const query = 'INSERT IGNORE INTO pushtokens (wallet, device_token, platform) VALUES (?, ?, ?)'

    const insert_push_token = async (query, logger) => {
      return new Promise((resolve, reject) => {
        db.query(
          query,
          [wallet, device_token_decrypted, platform_decrypted],
          function (err, results) {
            if (err) {
              logger.error(err)
              return reject(err)
            } else {
              logger.debug(results)
              console.log(results)
              return resolve({ success: 1, data: results })
            }
          }
        )
      })
    }

    try {
      const response = await insert_push_token(query, logger)

      if (response.success) {
        // Check Operation
        logger.debug(response.data)
        return { success: 1 }
      }
    } catch (err) {
      logger.error(err)
      throw err
    }
  }

  // To delete device tokens
  public async deleteDeviceTokens(tokens: any[]) {
    const logger = this.logger
    logger.debug('Trying to delete device tokens: %o', tokens)

    const queryClause = "('" + tokens.join("','") + "')"
    const query = 'DELETE from pushtokens WHERE device_token IN ' + queryClause

    return await new Promise((resolve, reject) => {
      db.query(query, function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed deleteDeviceTokens(): %o', response)
        return { success: 1 }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  // To delete wallet on a device
  public async deleteWalletAndDevice(wallet: string, device_token: string) {
    const logger = this.logger
    logger.debug('Trying to delete wallet: %o registered on the device: %o', wallet, device_token)
    const query = 'DELETE from pushtokens WHERE wallet=? AND device_token=?'
    return await new Promise((resolve, reject) => {
      db.query(query, [wallet, device_token], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info(
          'Completed deletion of wallet: %o registered on the device: %o. Response: %o',
          wallet,
          device_token,
          JSON.stringify(response)
        )
        return {
          success: 1
        }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }
}
