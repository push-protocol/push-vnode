// Do Versioning
// Function
// upgradeScript() -> Runs for upgrading version
// downgradeScript() -> Runs for downgrading version
// Use this template upper functions to make this work well
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../config'
import { convertCaipToAddress } from '../../helpers/caipHelper'
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
      const fetchQuery = 'SELECT channel, iconV2 FROM channels'
      const updateQuery = 'UPDATE channels SET icon = ? WHERE channel = ?'

      try {
        const channelsData: { channel: string; iconV2: string }[] = await new Promise(
          (resolve, reject) => {
            db.query(
              fetchQuery,
              function (err: any, results: { channel: string; iconV2: string }[]) {
                if (err) {
                  console.log(err)
                  crashWithError(err)
                  reject(err)
                } else {
                  resolve(results)
                }
              }
            )
          }
        )

        for (const channelData of channelsData) {
          const { channel, iconV2 } = channelData
          if (iconV2 === null) continue
          const channelAddress = convertCaipToAddress(channel).result
          const fileName = `${channelAddress}`
          const iconUrl = `${config.backendURL}/apis/v1/channels/icon/${fileName}`
          await new Promise((resolve, reject) => {
            db.query(updateQuery, [iconUrl, channel], function (err: any) {
              if (err) {
                console.log(err)
                crashWithError(err)
                reject(err)
              } else {
                resolve(true)
              }
            })
          })
        }
      } catch (err) {
        console.log(err)
        crashWithError(err)
        reject(err)
      }

      logger.info('Changed Icon from server cache to route')
      logger.info('Upgraded to version 70')
      resolve(true)
    })
  }
  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 70 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
