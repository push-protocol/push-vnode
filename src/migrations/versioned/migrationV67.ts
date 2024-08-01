// Do Versioning
// Function
// upgradeScript() -> Runs for upgrading version
// downgradeScript() -> Runs for downgrading version
// Use this template upper functions to make this work well
import * as fs from 'fs'
import * as path from 'path'
import { Container } from 'typedi'
import { promisify } from 'util'
import { Logger } from 'winston'

import config from '../../config'
import { convertCaipToAddress } from '../../helpers/caipHelper'
import * as db from '../../helpers/dbHelper'
import { DynamicLogger } from '../../loaders/dynamicLogger'
const utils = require('../../helpers/utilsHelper')

const publicDir = `${config.staticCachePath}/channels/`

const writeFilePromise = promisify(fs.writeFile)
const mkdirPromise = promisify(fs.mkdir)

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

  async function ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await mkdirPromise(dirPath, { recursive: true })
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err
      }
    }
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
          const matches = iconV2.match(/^data:image\/(png|jpe?g);base64,(.+)/)
          const iconType = matches[1] // Image extension (png, jpg, or jpeg)
          const base64Content = matches[2] // Base64 image content

          const fileName = `${channelAddress}.${iconType}`
          const filePath = path.join(publicDir, fileName)
          const fileBuffer = Buffer.from(base64Content, 'base64')
          await ensureDirectoryExists(publicDir)
          await writeFilePromise(filePath, fileBuffer)
          const iconUrl = `${config.fsServerURL}/channels/${fileName}`
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

      logger.info('Changed Icon gateway from IPFS to Local cache')
      logger.info('Upgraded to version 67')
      resolve(true)
    })
  }
  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 67 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
