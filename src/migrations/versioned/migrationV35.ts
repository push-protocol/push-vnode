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
      const selectQuery = 'SELECT id, profile_picture, about, name FROM w2w_meta LIMIT ? OFFSET ?'
      const updateQuery = 'UPDATE w2w_meta SET profile = ? WHERE id = ?'
      let moreResults = true

      const processResults = async () => {
        try {
          const results: [{ id: number; profile_picture: string; about: string; name: string }] =
            await new Promise((resolve, reject) => {
              db.query(
                selectQuery,
                [limit, offset],
                function (
                  err: any,
                  results: [{ id: number; profile_picture: string; about: string; name: string }]
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
            const { id, profile_picture, about, name } = _item

            const profile = {
              name: name || null,
              desc: about || null,
              picture: profile_picture || null,
              profileVerificationProof: null
            }

            const profileJSON = JSON.stringify(profile)

            await new Promise((resolve, reject) => {
              db.query(updateQuery, [profileJSON, id], function (err: any) {
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

      logger.info('Migrated profile data into profile JSON column')
      logger.info('Upgraded to version 35')
      resolve(true)
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 35 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
