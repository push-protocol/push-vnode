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
    // Migration Requirements
    // 1. Create these new columns
    const query1 = `ALTER TABLE w2w
                    ADD COLUMN chat_id varchar(255) NULL,
                    ADD COLUMN group_name varchar(255) NULL,
                    ADD COLUMN profile_picture_cid varchar(512) NULL,
                    ADD COLUMN admins TEXT NULL,
                    ADD COLUMN is_public TINYINT DEFAULT 0 NOT NULL,
                    ADD COLUMN contract_address_nft varchar(255) NULL,
                    ADD COLUMN number_of_nfts int(24) DEFAULT 0 NOT NULL,
                    ADD COLUMN contract_address_erc20 varchar(255) NULL,
                    ADD COLUMN number_of_erc20 int(24) DEFAULT 0 NOT NULL,
                    ADD COLUMN verification_proof TEXT NULL
                    `

    return new Promise((resolve, reject) => {
      // Update column type
      db.query(query1, [], function (err: any) {
        logger.debug('Added new columns to w2w')
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          logger.info('Upgraded to version 16')
          resolve(true)
        }
      })
    })
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 16 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
