import axios, { AxiosResponse } from 'axios'
import Container from 'typedi'
import { Logger } from 'winston'

import config from '../../config'
import * as db from '../../helpers/dbHelper'

export const checkChannelIconMigration = async () => {
  /**
   * MIGRATION PLAN
   * 1. Read channel, icon and iconV2 from channels table
   * 2. Fetch icon from ipfs
   * 3. Check if it matches with iconV2
   *
   * ERROR DETECTION
   * To check No. of records with icon_migration as 0 - NOT RESOLVED
   * To check No. of records with icon_migration as -1 - NOT MATCHED
   */
  const channelAndHash = await getChannelAndIcon()

  for (const channelPayload of channelAndHash) {
    const { channel, icon, iconV2 } = channelPayload
    let obj: { [x: string]: any }
    let err: any

    try {
      // Resolving icon hash
      const parts = icon.split('ipfs/')

      const response: AxiosResponse<ArrayBuffer> = await axios.get(config.ipfsGateway + parts[1], {
        timeout: 10000,
        responseType: 'arraybuffer'
      })
      const iconType = iconV2.split(';')[0]
      // @ts-ignore
      const base64Data = Buffer.from(response.data, 'binary').toString('base64')
      const resolvedIconV2 = `${iconType};base64,${base64Data}`

      if (resolvedIconV2 !== iconV2) {
        await updateChannelIconMigration(-1, channel)
        throw new Error('Icon hash does not match')
      } else {
        await updateChannelIconMigration(1, channel)
        const Logger: Logger = Container.get('logger')
        Logger.info(`Icon hash matches for channel ${channel}`)
      }
    } catch (e) {
      // console.log(e)
      try {
        // Resolving icon hash
        const parts = icon.split('ipfs/')
        const response: AxiosResponse<string> = await axios.get(
          'http://127.0.0.1:8080/ipfs/' + parts[1],
          {
            timeout: 10000
          }
        )
        if (response.data === iconV2) {
          await updateChannelIconMigration(1, channel)
        } else {
          await updateChannelIconMigration(-1, channel)
        }
      } catch (e) {
        const Logger: Logger = Container.get('logger')
        Logger.warn(`Error fetching icon ipsaHash for channel ${channel}`)
      }
    }
  }
}

const getChannelAndIcon = async () => {
  const query = `SELECT channel, icon, iconV2 FROM channels WHERE icon_migration != 1`
  const channelAndIcon: { channel: string; icon: string; iconV2: string }[] = await new Promise(
    (resolve, reject) => {
      ;(db as any).query(
        query,
        [],
        (err: any, results: { channel: string; icon: string; iconV2: string }[]) => {
          if (err) return reject(err)
          resolve(results)
        }
      )
    }
  )
  return channelAndIcon
}

const updateChannelIconMigration = async (iconMigration: -1 | 1, channel: string) => {
  const query = `UPDATE channels SET icon_migration = ? WHERE channel = ?`
  await new Promise((resolve, reject) => {
    ;(db as any).query(query, [iconMigration, channel], (err: any) => {
      if (err) return reject(err)
      resolve(true)
    })
  })
}
