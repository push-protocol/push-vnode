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
import CryptoJs from 'crypto-js'

/**
 * This migration is for the w2w context. It's responsible for generating chatIds
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
    // 1. Get columns
    // 2. Populate chatId
    const query1 = `SELECT id, combined_did, threadhash, intent_timestamp from w2w where chat_id is NULL`
    const query2 = `UPDATE w2w SET chat_id = ? where id = ?`
    return new Promise((resolve, reject) => {
      db.query(
        query1,
        [],
        function (err: any, results: [{ id; intent_timestamp; threadhash; combined_did }]) {
          if (err) {
            crashWithError(err)
            reject(err)
          } else {
            for (const item of results) {
              const chatId = CryptoJs.SHA256(
                JSON.stringify({
                  combinedDID: item.combined_did,
                  threadhash: item.threadhash,
                  timestamp: item.intent_timestamp
                })
              ).toString()
              db.query(query2, [chatId, item.id], function (err: any) {
                if (err) {
                  crashWithError(err)
                  reject(err)
                } else {
                  logger.debug(`Completed for id : ${item.id}`)
                  resolve(true)
                }
              })
            }
            logger.info('Upgraded to version 22')
            resolve(true)
          }
        }
      )
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 22 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
