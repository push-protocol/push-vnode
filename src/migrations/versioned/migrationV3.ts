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
    // 1. DB Change: add channels.counter
    const query1 = 'ALTER TABLE `channels` ADD `counter` INT(11) DEFAULT NULL;'

    // const batchedQuery = `${query1} ${query2} ${query3} ${query4}`; // CAN'T DO BEGIN END BLOCK AS ALTER IS NOT ALLOWED
    logger.info(`Executing Queries...`)

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          logger.info('Upgraded to version 3')
          resolve(true)
        }
      })
    })
  }

  const downgradeScript = async () => {
    // Migration Requirements
    // 1. DB Change: delete channels.counter
    const query1 = 'ALTER TABLE `channels` DROP COLUMN `counter`;'

    // const batchedQuery = `${query1} ${query2} ${query3} ${query4}`; // CAN'T DO BEGIN END BLOCK AS ALTER IS NOT ALLOWED
    logger.info(`Executing Queries...`)

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          logger.info('Downgraded from version 3')
          resolve(true)
        }
      })
    })
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
