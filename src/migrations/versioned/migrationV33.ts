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
 * This migration is for the w2w context. It's responsible for adding new columns on w2w table for the introduction of group chats
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
    return new Promise(async (resolve, reject) => {
      const limit = 5000
      let offset = 0
      const selectQuery = 'SELECT id, signature, sig_type FROM w2w_meta LIMIT ? OFFSET ?'
      const updateQuery = 'UPDATE w2w_meta SET verification_proof = ? WHERE id = ?'
      let moreResults = true

      const processResults = async () => {
        try {
          const results: [{ id: number; signature: string; sig_type: string }] = await new Promise(
            (resolve, reject) => {
              db.query(
                selectQuery,
                [limit, offset],
                function (
                  err: any,
                  results: [{ id: number; signature: string; sig_type: string }]
                ) {
                  if (err) {
                    console.log(err)
                    crashWithError(err)
                    reject(err)
                  } else {
                    if (results.length === 0) {
                      moreResults = false
                    }
                    resolve(results)
                  }
                }
              )
            }
          )

          for (const _item of results) {
            const { id, signature, sig_type } = _item

            // Skip the update if signature or sig_type is empty
            if (!signature || !sig_type) {
              continue
            }

            const verificationProof = `${sig_type}:${signature}`

            await new Promise((resolve, reject) => {
              db.query(updateQuery, [verificationProof, id], function (err: any) {
                if (err) {
                  console.log(err)
                  crashWithError(err)
                  reject(err)
                } else {
                  resolve()
                }
              })
            })
          }

          return moreResults
        } catch (err) {
          console.log(err)
          crashWithError(err)
          reject(err)
        }
      }

      while (moreResults) {
        moreResults = await processResults()
        offset += limit
      }

      logger.info('Upgraded signatures to include verification_proof column')
      logger.info('Upgraded to version 33')
      resolve(true)
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 33 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
