// Do Versioning
// Function
// upgradeScript() -> Runs for upgrading version
// downgradeScript() -> Runs for downgrading version
// Use this template upper functions to make this work well
import { Container } from 'typedi'

import config from '../../config'
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
    // 1. DB Change: modify delegates.delegate length
    // 2. DB Change: change delegates.delegate to caip format
    // 3. DB Change: drop delegates.blockchain
    // 4. DB Change: edit unique index

    const query1 = 'ALTER TABLE `delegates` MODIFY delegate varchar(128) NOT NULL'
    const query2 = `UPDATE delegates SET delegate = CONCAT("eip155:", "${config.polygonChainId}" ,":", delegate) WHERE blockchain = "${config.polygonId}"`
    const query3 = `UPDATE delegates SET delegate = CONCAT("eip155:", "${config.ethereumChainId}" ,":", delegate) WHERE blockchain != "${config.polygonId}" or blockchain IS NULL`
    const query4 = 'ALTER TABLE `delegates` DROP COLUMN `blockchain`'
    const query5 =
      'ALTER TABLE `delegates` DROP INDEX `combined_channel_delegate`, ADD UNIQUE `combined_channel_delegate` (`channel`, `delegate`) USING BTREE'

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
                      db.query(query5, [], function (err) {
                        if (err) {
                          crashWithError(err)
                          reject(err)
                        } else {
                          logger.info('Upgraded to version 11')
                          resolve(true)
                        }
                      })
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
    // 1. DB Change: modify delegates.delegate length
    // 2. DB Change: change delegates.delegate to normal format
    // 3. DB Change: add delegates.blockchain
    // 4. DB Change: edit unique index

    const query1 = 'ALTER TABLE `delegates` ADD COLUMN `blockchain` varchar(255) DEFAULT NULL'
    const query2 =
      'ALTER TABLE `delegates` DROP INDEX `combined_channel_delegate`, ADD UNIQUE `combined_channel_delegate` (`channel`, `delegate`, `blockchain`) USING BTREE'
    const query3 = `UPDATE delegates SET blockchain = "${config.ethereumId}" WHERE SUBSTRING(delegate, 8, 1) = ${config.ethereumChainId}`
    const query4 = `UPDATE delegates SET blockchain = "${config.polygonId}" WHERE SUBSTRING(delegate, 8, 1) != ${config.ethereumChainId}`
    const query5 = 'UPDATE `delegates` SET `delegate` = SUBSTRING_INDEX(`delegate`, ":", -1)'

    const query6 = 'ALTER TABLE `delegates` MODIFY delegate varchar(42) NOT NULL'

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
                      db.query(query5, [], function (err) {
                        if (err) {
                          crashWithError(err)
                          reject(err)
                        } else {
                          db.query(query5, [], function (err) {
                            if (err) {
                              crashWithError(err)
                              reject(err)
                            } else {
                              logger.info('Downgraded from version 11')
                              resolve(true)
                            }
                          })
                        }
                      })
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
