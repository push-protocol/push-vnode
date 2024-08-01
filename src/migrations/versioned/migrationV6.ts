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
    //TODO: Include db script to change prepared_payload to feed_payload
    // 1. DB Change: DROP apns and android from feeds

    const query1 =
      'UPDATE feeds SET feeds.feed_payload = JSON_REMOVE(feeds.feed_payload, "$.apns", "$.android");'

    //These queries needs to be processed in a sequential format rather than parallel
    logger.info(`Executing Queries...`)

    return await new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          resolve(true)
        }
      })
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 6 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
