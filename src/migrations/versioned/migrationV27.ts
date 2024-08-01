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
import { CID } from 'ipfs-http-client'

import { getFromIPFS } from '../../db-access/w2w/ipfs'
import { addCid } from '../../db-access/w2w/w2w-meta'
import { writeJsonToFile } from '../../helpers/fileStorageHelper'
import { Message } from '../../interfaces/chat'
const fs = require('fs')
const path = require('path')
const os = require('os')
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
      const selectQuery = 'SELECT linked_list_hash from w2w_meta LIMIT ? OFFSET ?'
      const rootDir = path.join(os.homedir(), 'chat')
      let moreResults = true

      const processResults = async () => {
        try {
          const results: [{ linked_list_hash: string }] = await new Promise((resolve, reject) => {
            db.query(
              selectQuery,
              [limit, offset],
              function (err: any, results: [{ linked_list_hash: string }]) {
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
            const linkedListHashItems = _item.linked_list_hash.split(',')
            linkedListHashItems.forEach(async (id) => {
              let isValidCID = false
              const cid = id.trim()
              try {
                if (cid && cid.length > 0) {
                  CID.parse(cid)
                  isValidCID = true
                }
              } catch (err) {
                logger.error(err)
              }

              if (isValidCID) {
                const message: Message = await getFromIPFS({ cid: cid })
                await writeJsonToFile(message, cid, rootDir)
                await addCid(id, true)
              }
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

      logger.info('Upgraded to version 27')
      resolve(true)
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 27 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
