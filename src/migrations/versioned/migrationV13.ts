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
    // 1. DB Change: Add payloads.verificationProof to feeds.feed_payload

    const query1 = `SELECT feeds.sid, feeds.feed_payload , payloads.verification_proof from feeds , payloads where ABS(feeds.payload_id) = payloads.id`
    const query2 = `UPDATE feeds SET feed_payload = ? where sid = ?`

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err: any, results: []) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          for (const item of results) {
            try {
              const updatedFeedPayload = JSON.parse(item.feed_payload)
              updatedFeedPayload['verificationProof'] = item.verification_proof
              db.query(
                query2,
                [JSON.stringify(updatedFeedPayload), item.sid],
                function (err: any, results: []) {
                  if (err) {
                    crashWithError(err)
                    reject(err)
                  } else {
                    logger.debug(`Completed for sid : ${item.sid}`)
                    resolve(true)
                  }
                }
              )
            } catch (err) {
              logger.error(err)
            }
          }
          logger.info('Upgraded to version 13')
          resolve(true)
        }
      })
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 13 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
