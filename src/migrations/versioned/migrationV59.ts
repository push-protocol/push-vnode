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
    // 1. Create these new columns
    const query1 = `SELECT intent_sent_by, chat_id, intent_timestamp FROM w2w WHERE group_name is not NULL and admins is NULL;`

    const groupsWithoutAdmin: {
      intent_sent_by: string
      chat_id: string
      intent_timestamp: string
    }[] = await new Promise((resolve, reject) => {
      ;(db as any).query(
        query1,
        [],
        function (
          err: any,
          results: { intent_sent_by: string; chat_id: string; intent_timestamp: string }[]
        ) {
          if (err) {
            crashWithError(err)
            reject(err)
          }
          resolve(results)
        }
      )
    })

    for (const group of groupsWithoutAdmin) {
      const { intent_sent_by, chat_id, intent_timestamp } = group
      const updateQuery1 = `UPDATE w2w SET admins = ?, intent_timestamp = ? WHERE chat_id = ?;`
      const updateData1 = [intent_sent_by, intent_timestamp, chat_id]
      await (db as any).query(updateQuery1, updateData1, function (err: any, results: any) {
        if (err) {
          crashWithError(err)
        }
      })

      const updateQuery2 = `UPDATE chat_members SET role = 'admin' WHERE chat_id = ? and address = ?;`
      const updateData2 = [chat_id, intent_sent_by]
      await (db as any).query(updateQuery2, updateData2, function (err: any, results: any) {
        if (err) {
          crashWithError(err)
        }
      })
    }
    return true
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 59 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
