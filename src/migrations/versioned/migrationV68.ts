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

type AliasDetails = {
  channel: string
  alias_address: string
  is_alias_verified: string
  alias_verification_event: string
  processed: string
  initiate_verification_proof: string
  verify_verification_proof: string
}

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
    // 1. Create these new columns in payloads tables for storing channel and delegatee.
    const query = `ALTER TABLE payloads
    ADD COLUMN channel VARCHAR(150) DEFAULT NULL,
    ADD COLUMN delegate VARCHAR(150) DEFAULT NULL;
    `

    const query1 = `ALTER TABLE feeds
    ADD COLUMN delegate VARCHAR(150) DEFAULT NULL;
    `

    return new Promise((resolve, reject) => {
      ;(db as any).query(query, [], function (err: any) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          ;(db as any).query(query1, [], async function (err: any) {
            if (err) {
              crashWithError(err)
              reject(err)
            } else {
              const results = await getChannelAliasData()

              for (const aliasPayload of results) {
                try {
                  await createAliases(aliasPayload)
                } catch (e) {
                  logger.warn(`Error creating aliases for channel ${aliasPayload.channel}`)
                }
              }

              logger.info('Upgraded to version 68')
              resolve(true)
            }
          })
        }
      })
    })
  }

  const getChannelAliasData = async () => {
    const query = `SELECT channel, alias_address, is_alias_verified, alias_verification_event, processed, initiate_verification_proof, verify_verification_proof FROM channels WHERE alias_address is NOT NULL OR alias_address != 'NULL'`

    const aliasDetails: AliasDetails[] = await new Promise((resolve, reject) => {
      ;(db as any).query(query, [], (err: any, results: AliasDetails[]) => {
        if (err) return reject(err)
        resolve(results)
      })
    })
    return aliasDetails
  }

  const createAliases = async (aliaspayload: AliasDetails) => {
    const query = `INSERT INTO aliases SET channel = ?, alias_address = ?, is_alias_verified = ?, alias_verification_event = ?, processed = ?, initiate_verification_proof = ?, verify_verification_proof = ?`
    await new Promise((resolve, reject) => {
      ;(db as any).query(
        query,
        [
          aliaspayload.channel,
          aliaspayload.alias_address,
          aliaspayload.is_alias_verified,
          aliaspayload.alias_verification_event,
          aliaspayload.processed,
          aliaspayload.initiate_verification_proof,
          aliaspayload.verify_verification_proof
        ],
        (err: any) => {
          if (err) return reject(err)
          resolve(true)
        }
      )
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 68 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
