// Do Versioning
// Function
// upgradeScript() -> Runs for upgrading version
// downgradeScript() -> Runs for downgrading version
// Use this template upper functions to make this work well
import { Container } from 'typedi'

import * as db from '../../helpers/dbHelper'
const utils = require('../../helpers/utilsHelper')
import FeedsService from '../../services/feedsService'

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
    // 1. DB Change: add feeds.migrated
    // 2. DB Change: populate feed_users from feeds

    const query1 = 'ALTER TABLE `feeds` ADD `migrated` tinyint(1) NOT NULL DEFAULT 0'
    const query2 = 'SELECT sid , users , is_spam from feeds WHERE migrated=0 LIMIT ? OFFSET ?'

    //These queries needs to be processed in a sequential format rather than parallel
    logger.info(`Executing Queries...`)

    await new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        resolve(true)
      })
    })

    const feeds = Container.get(FeedsService)

    const limit = 5000
    let offset = 0

    let moreResults = true
    let count = 0
    while (moreResults) {
      await new Promise(async (resolve, reject) => {
        await db.query(query2, [limit, offset], function (err, results) {
          if (err) {
            return reject(err)
          } else {
            return resolve(results)
          }
        })
      })
        .then(async (response) => {
          count += response.length
          if (!response.length) moreResults = false
          for (const item of response) {
            try {
              await feeds.migrateFeed(item.sid, item.is_spam, JSON.parse(item.users))
            } catch (err) {
              logger.error(err)
            }
          }
        })
        .catch((err) => {
          logger.error(err)
          throw err
        })
      offset = offset + limit
      if (moreResults) logger.debug('Total Feeds Migrated till now : %s', count)
    }
    logger.info('Upgraded to version 9')
    return { success: 1 }
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 9 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
