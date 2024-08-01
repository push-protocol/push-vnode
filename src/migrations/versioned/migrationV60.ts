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
    // 1. Create these new columns
    const query = `ALTER TABLE feeds
    ADD COLUMN channel VARCHAR(150) DEFAULT NULL,
    ADD INDEX idx_sender (sender),
    ADD INDEX idx_channel (channel);`

    return new Promise((resolve, reject) => {
      ;(db as any).query(query, [], function (err: any) {
        if (err) {
          crashWithError(err)
          reject(err)
        }
        logger.info('Upgraded to version 56')
        resolve(true)
      })
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 60 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
