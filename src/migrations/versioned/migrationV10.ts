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
 * This migration is for the w2w context. It's responsive from changing the intents column from Enum data type to text where its values will be
 * the did concatenated separated by `+` symbol.
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
    // 1. Change intents type from enum to text
    // 2. Fill the new intents column with correct value
    // 3. Update the intent value
    const query1 = 'ALTER TABLE w2w MODIFY COLUMN intent TEXT'
    const query2 = 'SELECT * from w2w'
    const query3 = 'UPDATE w2w SET intent=? WHERE combined_did=?'

    logger.debug(`Executing Queries but seperatedly since alter table can't be in a transcation`)

    return new Promise((resolve, reject) => {
      // Update column type
      db.query(query1, [], function (err: any) {
        logger.debug('Query 1 executed')
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          // Get all chats
          db.query(query2, [], function (err: any, chats) {
            logger.debug('Query 2 executed')
            if (err) {
              crashWithError(err)
              reject(err)
            } else {
              logger.debug('Query 2 executed sucessfully with results: %o', chats)

              for (const w2w of chats) {
                let dids: string[] = w2w.combined_did.split('_')
                dids = dids.filter((did) => did.includes('did:3:'))
                let intent: string
                if (dids.length === 2) {
                  intent = dids.join('+')
                } else if (dids.length === 1) {
                  intent = dids[0]
                } else {
                  crashWithError('Invalid combined_did')
                  reject('Invalid combined_did')
                }
                // Update intent value to new one
                db.query(query3, [intent, w2w.combined_did], function (err: any) {
                  if (err) {
                    crashWithError(err)
                    reject(err)
                  } else {
                    logger.debug(`Transformed ${w2w.combined_did} intent to ${intent}`)
                  }
                })
              }

              // after for loop, resolve
              logger.info('Upgraded to version 9')
              resolve(true)
            }
          })
        }
      })
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 9 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
