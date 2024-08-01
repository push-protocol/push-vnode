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
    // 1. DB Change: add channels.subgraph_details
    // 2. DB Change: populate channels.subgraph_details = channels.sub_graph_id:channels.poll_time
    // 3. DB Change: drop channels.sub_graph_id
    // 4. DB Cahnge: drop channels.poll_time

    const query1 = 'ALTER TABLE `channels` ADD `subgraph_details` varchar(255) DEFAULT NULL;'
    const query2 =
      'UPDATE `channels` SET `subgraph_details` = CONCAT(`poll_time`, "+", `sub_graph_id`) WHERE `sub_graph_id` IS NOT NULL AND sub_graph_id NOT LIKE "NULL";'
    const query3 = 'ALTER TABLE `channels` DROP COLUMN `sub_graph_id`;'
    const query4 = 'ALTER TABLE `channels` DROP COLUMN `poll_time`;'

    //These queries needs to be processed in a sequential format rather than parallel
    logger.info(`Executing Queries...`)

    await new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          resolve(true)
        }
      })
    })
    await new Promise((resolve, reject) => {
      db.query(query2, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          resolve(true)
        }
      })
    })

    return new Promise((resolve, reject) => {
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
              logger.info('Upgraded to version 5')
              resolve(true)
            }
          })
        }
      })
    })
  }

  const downgradeScript = async () => {
    // Migration Requirements
    // 1. DB Change: add channels.sub_graph_id
    // 2. DB Change: add channels.poll_time
    // 3. DB Change: populate channels.sub_graph_id & channels.poll_time
    // 4. DB Cahnge: drop channels.subgraph_details

    const query1 = 'ALTER TABLE `channels` ADD `sub_graph_id` varchar(255) DEFAULT NULL;'
    const query2 = 'ALTER TABLE `channels` ADD `poll_time` int(11) DEFAULT NULL;'
    const query3 =
      'UPDATE `channels` SET `poll_time` = SUBSTRING_INDEX(`subgraph_details`, "+", 1), sub_graph_id = SUBSTRING_INDEX(`subgraph_details`, "+", -1);'
    const query4 = 'ALTER TABLE `channels` DROP COLUMN `subgraph_details`;'

    //These queries needs to be processed in a sequential format rather than parallel
    logger.info(`Executing Queries...`)

    await new Promise((resolve, reject) => {
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
              resolve(true)
            }
          })
        }
      })
    })

    await new Promise((resolve, reject) => {
      db.query(query3, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          resolve(true)
        }
      })
    })
    return new Promise((resolve, reject) => {
      db.query(query4, [], function (err) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          logger.info('Downgraded from version 5')
          resolve(true)
        }
      })
    })
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
