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
    return new Promise(async (resolve, reject) => {
      const limit = 5000
      let offset = 0
      const selectQuery =
        'SELECT id, nft_owner, pgp_priv_enc FROM w2w_meta WHERE nft_owner IS NOT NULL LIMIT ? OFFSET ?'
      const updateQuery = 'UPDATE w2w_meta SET pgp_priv_enc = ? WHERE id = ?'
      let moreResults = true

      const processResults = async () => {
        try {
          const results: [{ id: number; nft_owner: string; pgp_priv_enc: string }] =
            await new Promise((resolve, reject) => {
              db.query(
                selectQuery,
                [limit, offset],
                function (
                  err: any,
                  results: [{ id: number; nft_owner: string; pgp_priv_enc: string }]
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
            })

          for (const _item of results) {
            const { id, nft_owner, pgp_priv_enc } = _item

            let privEncJSON
            try {
              privEncJSON = pgp_priv_enc ? JSON.parse(pgp_priv_enc) : {}
            } catch (e) {
              privEncJSON = {}
            }

            privEncJSON.owner = nft_owner
            const updatedPrivEncJSON = JSON.stringify(privEncJSON)

            await new Promise((resolve, reject) => {
              db.query(updateQuery, [updatedPrivEncJSON, id], function (err: any) {
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

      logger.info('Migrated nft_owner data into pgp_priv_enc JSON column')
      logger.info('Upgraded to version 36')
      resolve(true)
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 36 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
