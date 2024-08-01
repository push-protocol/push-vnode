// Do Versioning
// Function
// upgradeScript() -> Runs for upgrading version
// downgradeScript() -> Runs for downgrading version
// Use this template upper functions to make this work well
import { Container } from 'typedi'

import * as db from '../../helpers/dbHelper'
const utils = require('../../helpers/utilsHelper')

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
    // 1. DB Change: change paylods.tx_hash to payloads.verification_proof
    // 2. DB Change: change paylods.msg_type to payloads.storage_type
    // 3. DB Change: delete paylods.use_push
    // 4. DB Change: delete feeds.use_push
    const query1 =
      'ALTER TABLE `payloads` CHANGE `tx_hash` `verification_proof` VARCHAR(255) NOT NULL;'
    const query2 = 'ALTER TABLE `payloads` CHANGE `msg_type` `storage_type` INT(11) NOT NULL;'
    const query3 = 'ALTER TABLE `payloads` DROP COLUMN `use_push`;'
    const query4 = 'ALTER TABLE `feeds` DROP COLUMN `use_push`;'

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
                      logger.info('Upgraded to version 2')
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
    // 1. DB Change: change paylods.verification_proof to payloads.tx_hash
    // 2. DB Change: change paylods.msg_type to payloads.storage_type
    // 3. DB Change: add paylods.use_push
    // 4. DB Change: add feeds.use_push
    const query1 =
      'ALTER TABLE `payloads` CHANGE `verification_proof` `tx_hash` VARCHAR(255) NOT NULL;'
    const query2 = 'ALTER TABLE `payloads` CHANGE `storage_type` `msg_type` INT(11) NOT NULL;'
    const query3 = "ALTER TABLE `payloads` ADD `use_push` INT(11) NOT NULL DEFAULT '1';"
    const query4 = "ALTER TABLE `feeds` ADD `use_push` INT(11) NOT NULL DEFAULT '1';"

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
                      logger.info('Downgraded from version 2')
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
