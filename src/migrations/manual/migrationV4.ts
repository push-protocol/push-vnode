import Container from 'typedi'
import { Logger } from 'winston'

import * as db from '../../helpers/dbHelper'
import { IPFSClient } from '../../helpers/ipfsClient'

export const populateChannelIconMigration = async () => {
  /**
   * MIGRATION PLAN
   * 1. Read ipfs hash from channels table
   * 2. Fetch icon from ipfs
   * 3. Update iconV2 column in channels table
   *
   * ERROR DETECTION
   * To check No. of records with iconV2 as null
   */
  const channelAndHash = await getChannelAndIPFSHash()

  for (const channelPayload of channelAndHash) {
    const { channel, ipfshash } = channelPayload
    let iconV2: string
    let obj: { [x: string]: any }
    let err: any

    try {
      obj = await IPFSClient.get(ipfshash)
      if (obj['icon']) {
        iconV2 = obj['icon']
        await updateChannelIconV2(iconV2, channel)
      }
    } catch (e) {
      const Logger: Logger = Container.get('logger')
      Logger.warn(`Error fetching ipfsHash for channel ${channel}`)
    }
  }
}

const getChannelAndIPFSHash = async () => {
  const query = `SELECT channel, ipfshash FROM channels where iconV2 is null`
  const channelAndHash: { channel: string; ipfshash: string }[] = await new Promise(
    (resolve, reject) => {
      ;(db as any).query(
        query,
        [],
        (err: any, results: { channel: string; ipfshash: string }[]) => {
          if (err) return reject(err)
          resolve(results)
        }
      )
    }
  )
  return channelAndHash
}

const updateChannelIconV2 = async (iconV2: string, channel: string) => {
  const query = `UPDATE channels SET iconV2 = ? WHERE channel = ?`
  await new Promise((resolve, reject) => {
    ;(db as any).query(query, [iconV2, channel], (err: any) => {
      if (err) return reject(err)
      resolve(true)
    })
  })
}
