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
    // 1. DB Change: add feeds.did
    const query1 = 'ALTER TABLE `feeds` ADD COLUMN `did` VARCHAR(255) DEFAULT NULL AFTER `users`;'
    // const batchedQuery = `${query1} ${query2} ${query3} ${query4}`; // CAN'T DO BEGIN END BLOCK AS ALTER IS NOT ALLOWED
    logger.info(`Executing Queries but seperatedly`)

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          logger.info('Upgraded to version 8')
          resolve(true)
        }
      })
    })
  }

  const downgradeScript = async () => {
    // Migration Requirements
    // 1. DB Change: remove feeds.did
    const query1 = 'ALTER TABLE `feeds` DROP COLUMN `did`;'

    // const batchedQuery = `${query1} ${query2} ${query3} ${query4}`; // CAN'T DO BEGIN END BLOCK AS ALTER IS NOT ALLOWED
    logger.info(`Executing Queries but seperatedly`)
    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          logger.info('Downgraded from version 8')
          resolve(true)
        }
      })
    })
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
