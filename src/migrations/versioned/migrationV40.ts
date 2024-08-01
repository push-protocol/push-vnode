// Do Versioning
// Function
// upgradeScript() -> Runs for upgrading version
// downgradeScript() -> Runs for downgrading version
// Use this template upper functions to make this work well
import { Container } from 'typedi'
import { Logger } from 'winston'

import * as db from '../../helpers/dbHelper'
import { DynamicLogger } from '../../loaders/dynamicLogger'
const utils = require('../../helpers/utilsHelper')

export default async (upgrade) => {
  const logger: Logger & { hijackLogger: (dynamicLogger: DynamicLogger) => void } =
    Container.get('logger')
  const dynamicLogger: DynamicLogger = Container.get('dynamicLogger')

  const crashWithError = (err: string) => {
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

  const upgradeScript = async (): Promise<boolean> => {
    // Migration Requirements
    // 1. Add column waitlist_status
    // 2. rename table to spaces_waitlist
    // 3. remove the existing data
    const query1 = 'ALTER TABLE w2w_whitelist ADD COLUMN waitlist_status tinyint(4) DEFAULT 0;'
    const query2 = 'TRUNCATE TABLE w2w_whitelist;'
    const query3 = 'ALTER TABLE w2w_whitelist RENAME  spaces_waitlist;'
    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err: any) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          db.query(query2, [], function (err: any) {
            if (err) {
              crashWithError(err)
              reject(err)
            } else {
              db.query(query3, [], function (err: any) {
                if (err) {
                  crashWithError(err)
                  reject(err)
                } else {
                  logger.info('Upgraded to version 40')
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
    crashWithError("Can't downgrade... Version 40 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
