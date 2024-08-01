// Do Versioning
// Function
// upgradeScript() -> Runs for upgrading version
// downgradeScript() -> Runs for downgrading version
// Use this template upper functions to make this work well
import { MD5 } from 'crypto-js'
import { ethers } from 'ethers'
import { Container } from 'typedi'
import util from 'util'
import { Logger } from 'winston'

import * as caipHelper from '../../helpers/caipHelper'
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
    // 1. Create a new column in the channels table for storing channel_id.
    // 2. Generate channel_id for each existing channel and update the channel_id column.
    const query1 = `ALTER TABLE channels 
    ADD channel_id VARCHAR(255),
    ADD UNIQUE KEY channel_id (channel_id);
    `

    const query2 = `SELECT channel FROM channels
    `
    const query3 = `UPDATE channels SET channel_id=? WHERE channel=?`
    try {
      let updatePromises = []
      const dbQuery = util.promisify(db.query).bind(db)
      const res = await dbQuery(query1, [])
      if (res) {
        const channels = await dbQuery(query2, [])
        if (channels) {
          updatePromises = channels.map((channel) => {
            const channel_id = MD5(
              ethers.utils.getAddress(caipHelper.convertCaipToAddress(channel.channel).result)
            ).toString()
            return dbQuery(query3, [channel_id, channel.channel])
          })
          Promise.all(updatePromises)
        }
      }
      return true
    } catch (error) {
      crashWithError(error)
    }
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 69 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
