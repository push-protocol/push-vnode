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
    // 1. DB Change: change paylods.ipfshash to payloads.identity
    // 2. DB Change: change paylods.blockchain to payloads.source
    // 3. DB Change: change feeds.blockchain to feeds.source
    const query1 = 'ALTER TABLE `payloads` CHANGE `ipfshash` `identity` VARCHAR(128) NOT NULL;'
    const query2 = 'ALTER TABLE `payloads` CHANGE `blockchain` `source` VARCHAR(128) NOT NULL;'
    const query3 = 'ALTER TABLE `feeds` CHANGE `blockchain` `source` VARCHAR(128) NOT NULL;'

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
                  logger.info('Upgraded to version 4')
                  resolve(true)
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
    // 1. DB Change: change paylods.identity to payloads.ipfshash
    // 2. DB Change: change paylods.source to payloads.blockchain
    // 3. DB Change: change feeds.source to feeds.blockchain
    const query1 = 'ALTER TABLE `payloads` CHANGE `identity` `ipfshash` VARCHAR(128) NOT NULL;'
    const query2 = 'ALTER TABLE `payloads` CHANGE `source` `blockchain` VARCHAR(128) NOT NULL;'
    const query3 = 'ALTER TABLE `feeds` CHANGE `source` `blockchain` VARCHAR(128) NOT NULL;'

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
                  logger.info('Downgraded from version 4')
                  resolve(true)
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
