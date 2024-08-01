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

/**
 * This migration is for the w2w context. It's responsive from changing whitelist table to include the new columns
 */
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
    // 1. Create these new columns
    // contract_address varchar(50) NULL,
    // chain_id varchar(10) NULL,
    // token_id text NULL,
    // event_id text NULL,
    const query1 = `ALTER TABLE w2w_whitelist 
                    ADD COLUMN contract_address VARCHAR(50) NULL,
                    ADD COLUMN chain_id VARCHAR(10) NULL,
                    ADD COLUMN token_id text NULL,
                    ADD COLUMN event_id text NULL`

    return new Promise((resolve, reject) => {
      // Update column type
      db.query(query1, [], function (err: any) {
        logger.debug('Added new columns to w2w_whitelist')
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          logger.info('Upgraded to version 11')
          resolve(true)
        }
      })
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 11 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
