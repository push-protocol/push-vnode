import Container from 'typedi'
import { Logger } from 'winston'

import { convertCaipToObject, isValidCAIP } from '../../helpers/caipHelper'
import * as db from '../../helpers/dbHelper'

export const addChannelMigration = async () => {
  /**
   * MIGRATION PLAN
   * 1. READ FROM FEEDS TABLE ( 10000 records at a time ) where sender_type = 0
   * 2. Check sender column to get chainId of sender
   * 3.
   *  3.1 if chainId is null, ignore
   *  3.2 if chainId IS 1 OR 11155111, set channel = sender ELSE set channel = alias address of sender
   *
   * ERROR DETECTION
   * To check No. of records with issue in migration - No. of NULL channels with sender_type = 0
   */

  const LIMIT = 10000
  const Logger: Logger = Container.get('logger')
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const senderAndSid = await getSenderAndSid(offset, LIMIT)
    if (senderAndSid.length === 0) {
      hasMore = false
      break
    }
    for (const row of senderAndSid) {
      if (!isValidCAIP(row.sender)) {
        Logger.error(`Invalid CAIP format for sender ${row.sender} and sid ${row.sid}`)
        continue
      }
      // Get chainId from sender CAIP
      const { result } = convertCaipToObject(row.sender)

      if (result.chainId === null) {
        Logger.error(`ChainId is null for sender ${row.sender} and sid ${row.sid}`)
        continue
      }
      let channel: string
      if (result.chainId !== '1' && result.chainId !== '11155111' && result.chainId !== '5') {
        try {
          channel = await getChannelFromAlias(row.sender)
        } catch (e) {
          Logger.error(`Error fetching channel for alias ${row.sender} and sid ${row.sid}`)
          continue
        }
      } else {
        channel = row.sender
      }
      await updateChannel(row.sid, channel)
    }
    offset += LIMIT
    Logger.info(`Processed ${offset} records`)
  }
}

const getSenderAndSid = async (offset: number, limit: number) => {
  const query = `SELECT sid, sender FROM feeds WHERE sender_type = 0 LIMIT ? OFFSET ?;`
  const senderAndSid: { sid: number; sender: string }[] = await new Promise((resolve, reject) => {
    ;(db as any).query(
      query,
      [limit, offset],
      (err: any, results: { sid: number; sender: string }[]) => {
        if (err) return reject(err)
        resolve(results)
      }
    )
  })
  return senderAndSid
}

const getChannelFromAlias = async (alias: string) => {
  const query = `SELECT channel FROM channels WHERE alias_address = ?`
  const channel: string = await new Promise((resolve, reject) => {
    ;(db as any).query(query, [alias], (err: any, results: { channel: string }[]) => {
      if (err || results.length === 0) return reject(err)
      resolve(results[0].channel)
    })
  })
  return channel
}

const updateChannel = async (sid: number, channel: string) => {
  const query = `UPDATE feeds SET channel = ? WHERE sid = ?`
  await new Promise((resolve, reject) => {
    ;(db as any).query(query, [channel, sid], (err: any) => {
      if (err) return reject(err)
      resolve(true)
    })
  })
}
