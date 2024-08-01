// Do Versioning
// Function
// upgradeScript() -> Runs for upgrading version
// downgradeScript() -> Runs for downgrading version
// Use this template upper functions to make this work well
import { Container } from 'typedi'

import * as db from '../../helpers/dbHelper'
const utils = require('../../helpers/utilsHelper')
import config from '../../config/index'

export default async (upgrade) => {
  const logger = Container.get('logger')
  const dynamicLogger = Container.get('dynamicLogger')

  const crashWithError = (err) => {
    dynamicLogger.updateFooterLogs(null)
    dynamicLogger.stopRendering()
    dynamicLogger.reset()
    logger.hijackLogger(null)

    logger.error(
      `🔥 Error executing [${
        upgrade ? 'Upgrade' : 'Downgrade'
      }] [${utils.getCallerFile()}] | err: ${err}`
    )
    process.exit(1)
  }

  const upgradeScript = async () => {
    // Migration Requirements
    // 1. DB Change: change paylods.channel to payloads.sender
    // 2. DB Change: add paylods.sender_type
    // 3. DB Change: change paylods.channel to payloads.sender
    // 4. DB Change: add paylods.sender_type
    const query1 = 'ALTER TABLE `payloads` CHANGE `channel` `sender` varchar(128) NOT NULL;'
    const query2 =
      'ALTER TABLE `payloads` ADD COLUMN `sender_type` SMALLINT NOT NULL DEFAULT "' +
      config.senderType.channel +
      '" AFTER `sender`;'
    const query3 = 'ALTER TABLE `feeds` CHANGE `channel` `sender` varchar(128) NOT NULL;'
    const query4 =
      'ALTER TABLE `feeds` ADD COLUMN `sender_type` SMALLINT NOT NULL DEFAULT "' +
      config.senderType.channel +
      '" AFTER `sender`;'

    // const batchedQuery = `${query1} ${query2} ${query3} ${query4}`; // CAN'T DO BEGIN END BLOCK AS ALTER IS NOT ALLOWED
    logger.info(`Executing Queries but seperatedly`)

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          db.query(query2, [], function (err) {
            if (err) {
              crashWithError(err)
              reject(err)
            } else {
              db.query(query3, [], function (err) {
                if (err) {
                  crashWithError(err)
                  reject(err)
                } else {
                  db.query(query4, [], function (err) {
                    if (err) {
                      crashWithError(err)
                      reject(err)
                    } else {
                      logger.info('Upgraded to version 7')
                      resolve(true)
                    }
                  })
                }
              })
            }
          })
        }
      })
    })
  }

  const downgradeScript = async () => {
    // Migration Requirements
    // 1. DB Change: change paylods.sender to payloads.channel
    // 2. DB Change: remove paylods.sender_type
    // 1. DB Change: change feeds.sender to feeds.channel
    // 2. DB Change: remove feeds.sender_type
    const query1 = 'ALTER TABLE `payloads` CHANGE `sender` `channel` VARCHAR(128) NOT NULL;'
    const query2 = 'ALTER TABLE `payloads` DROP COLUMN `sender_type`;'
    const query3 = 'ALTER TABLE `feeds` CHANGE `sender` `channel` VARCHAR(128) NOT NULL;'
    const query4 = 'ALTER TABLE `feeds` DROP COLUMN `sender_type`;'

    // const batchedQuery = `${query1} ${query2} ${query3} ${query4}`; // CAN'T DO BEGIN END BLOCK AS ALTER IS NOT ALLOWED
    logger.info(`Executing Queries but seperatedly`)

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          db.query(query2, [], function (err) {
            if (err) {
              crashWithError(err)
              reject(err)
            } else {
              db.query(query3, [], function (err) {
                if (err) {
                  crashWithError(err)
                  reject(err)
                } else {
                  db.query(query4, [], function (err) {
                    if (err) {
                      crashWithError(err)
                      reject(err)
                    } else {
                      logger.info('Downgraded from version 7')
                      resolve(true)
                    }
                  })
                }
              })
            }
          })
        }
      })
    })
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
