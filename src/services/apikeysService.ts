import { Inject, Service } from 'typedi'

import { EventDispatcher, EventDispatcherInterface } from '../decorators/eventDispatcher'
const bcrypt = require('bcrypt')

const db = require('../helpers/dbHelper')
const utils = require('../helpers/utilsHelper')

@Service()
export default class APIKeysService {
  constructor(
    @Inject('logger') private logger,
    @EventDispatcher() private eventDispatcher: EventDispatcherInterface
  ) {}

  public async createAPIKey(validityInDays: int) {
    const logger = this.logger
    const prefix = utils.generateRandomWord(10, false)
    const key = utils.generateRandomWord(64, false)

    const salt = await bcrypt.genSalt(10)
    const key_hash = await bcrypt.hash(key, salt)

    const validity_up_to = new Date()
    validity_up_to.setDate(validity_up_to.getDate() + validityInDays)
    const query = 'INSERT IGNORE INTO api_keys (prefix, key_hash, validity_up_to) VALUES (?, ?, ?)'

    const insert_api_key = async (query, logger) => {
      return new Promise((resolve, reject) => {
        db.query(query, [prefix, key_hash, validity_up_to], function (err, results) {
          if (err) {
            logger.error(err)
            return reject(err)
          } else {
            return resolve({
              success: 1
            })
          }
        })
      })
    }
    try {
      const response = await insert_api_key(query, logger)
      if (response.success) {
        return {
          apiKey: prefix + '.' + key,
          validityUpTo: validity_up_to
        }
      }
    } catch (err) {
      logger.error(err)
      throw err
    }
  }

  public async deleteAPIKey(apiKey: string) {
    const logger = this.logger
    logger.debug('Trying to delete api_key: %o', apiKey)

    const list = apiKey.split('.')
    const query = 'DELETE from api_keys WHERE prefix=?'
    return await new Promise((resolve, reject) => {
      db.query(query, [list[0]], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info(
          'Completed api key deletion :: %o Response: %o',
          apiKey,
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

  public async getAPIKey(apiKey: string) {
    const logger = this.logger
    const list = apiKey.split('.')
    const query = `SELECT key_hash, validity_up_to from api_keys WHERE prefix='${list[0]}' LIMIT 1;`
    return await new Promise((resolve, reject) => {
      db.query(query, async function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length == 0) {
            resolve(null)
          } else {
            const response = {
              key_hash: results[0]['key_hash'],
              validity_up_to: results[0]['validity_up_to']
            }
            logger.info('Completed getAPIKey(api_key) with result', response)
            resolve(response)
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }
}
