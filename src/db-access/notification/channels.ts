import { Container } from 'typedi'
import { Logger } from 'winston'

import * as db from '../../helpers/dbHelper'

/**
 * GET DETAILS OF AN ALIAS
 * @param alias alias address in CAIP format
 */
export async function getAliasDetails(alias: string): Promise<{
  channel: string
  alias_address: string
  is_alias_verified: number
  blocked: number
  activation_status: number
} | null> {
  const logger: Logger = Container.get('logger')

  return new Promise((resolve, reject) => {
    ;(db as any).query(
      `SELECT a.channel, a.alias_address, a.is_alias_verified, c.blocked, c.activation_status FROM aliases a JOIN channels c ON a.channel = c.channel
      WHERE a.alias_address = ?;`,
      [alias],
      function (
        err: any,
        results: {
          channel: string
          alias_address: string
          is_alias_verified: number
          blocked: number
          activation_status: number
        }[]
      ) {
        if (err) {
          logger.error(err)
          reject(err)
        }
        if (results.length > 0) {
          resolve(results[0])
        } else {
          resolve(null)
        }
      }
    )
  })
}
