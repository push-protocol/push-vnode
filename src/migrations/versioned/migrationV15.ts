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
    // 1. DB Change: remove paylods.timestamp on update attribute
    // 2. DB Change: remove feeds.epoch on update attribute
    const query1 =
      'ALTER TABLE feeds MODIFY COLUMN epoch TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;'
    const query2 =
      'ALTER TABLE payloads MODIFY COLUMN timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;'

    logger.info(`Executing Queries...`)

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
              logger.info('Upgraded to version 15')
              resolve(true)
            }
          })
        }
      })
    })
  }

  const downgradeScript = async () => {
    // Migration Requirements
    // 1. DB Change: add paylods.timestamp on update attribute
    // 2. DB Change: add feeds.epoch on update attribute
    const query1 =
      'ALTER TABLE feeds MODIFY COLUMN epoch TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;'
    const query2 =
      'ALTER TABLE payloads MODIFY COLUMN timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;'

    logger.info(`Executing Queries...`)

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
              logger.info('Downgraded from version 15')
              resolve(true)
            }
          })
        }
      })
    })
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
