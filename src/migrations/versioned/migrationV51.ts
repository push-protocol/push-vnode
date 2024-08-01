import { Container } from 'typedi'
import { Logger } from 'winston'

import * as db from '../../helpers/dbHelper'
import { DynamicLogger } from '../../loaders/dynamicLogger'
const utils = require('../../helpers/utilsHelper')

/**
 * NOTE :- This migration is same as v47 migration with a `case` issue fixed for addresses
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
    let offset = 0
    const pageSize = 5000
    let hasMore = true

    logger.info('Starting to populate chat_members from w2w...')
    // Keep looping until there are no more records
    while (hasMore) {
      logger.info(`Fetching records from offset ${offset}...`)

      const selectQuery = `
      SELECT * FROM w2w
      LIMIT ?, ?;
    `

      // Fetch a page of records from w2w
      const w2wRows = await new Promise<any[]>((resolve, reject) => {
        db.query(selectQuery, [offset, pageSize], (err, results) => {
          if (err) return reject(err)
          resolve(results)
        })
      })

      logger.info(`Processing ${w2wRows.length} records...`)
      // If no records are fetched, stop the loop
      if (!w2wRows.length) {
        hasMore = false
        logger.info('No more records to fetch.')
        break
      }

      // Process each record
      for (const row of w2wRows) {
        const combinedDidArray = row.combined_did.toLowerCase().split('_')
        const adminArray = row.admins ? row.admins.toLowerCase().split('_') : []
        const intentArray = row.intent ? row.intent.toLowerCase().split('+') : []

        // Populate chat_members based on combined_did
        for (const did of combinedDidArray) {
          const role = adminArray.includes(did) ? 'admin' : 'member'
          const intent = intentArray.includes(did) ? 1 : 0

          // Insert into chat_members or update if exists
          const upsertQuery = `
          INSERT INTO chat_members (chat_id, address, role, intent)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            role = VALUES(role),
            intent = VALUES(intent);
        `

          // Execute the insert query
          await new Promise<void>((resolve, reject) => {
            db.query(upsertQuery, [row.chat_id, did, role, intent, row.chat_id, did], (err) => {
              if (err) reject(err)
              else resolve()
            })
          })
        }
      }

      // Increment the offset for the next page of records
      offset += pageSize
    }

    logger.info('Finished populating chat_members from w2w.')
    return true
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 51 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
