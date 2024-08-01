// Do Versioning
// Function
// upgradeScript() -> Runs for upgrading version
// downgradeScript() -> Runs for downgrading version
// Use this template upper functions to make this work well
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../config'
import * as db from '../../helpers/dbHelper'
import { DynamicLogger } from '../../loaders/dynamicLogger'
const utils = require('../../helpers/utilsHelper')

export default async (upgrade) => {
  const logger: Logger & { hijackLogger: (dynamicLogger: DynamicLogger) => void } =
    Container.get('logger')
  const dynamicLogger: DynamicLogger = Container.get('dynamicLogger')
  console.log(process.env.PUSH_NODES_NET)
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
    // Migrate caip from goerli to sepolia
    const query1 = `UPDATE subscribers 
      SET channel = REPLACE(channel, 'eip155:5', 'eip155:11155111') 
      WHERE channel like 'eip155:5:%'`
    const query2 = `UPDATE channels
     SET channel = REPLACE(channel, 'eip155:5', 'eip155:11155111'), 
     is_alias_verified=0 
     WHERE channel like 'eip155:5:%' `
    const query3 = `UPDATE delegates 
     SET channel = REPLACE(channel, 'eip155:5', 'eip155:11155111'),
     delegate = REPLACE(delegate, 'eip155:5', 'eip155:11155111') 
     WHERE channel like 'eip155:5:%' `
    return new Promise((resolve, reject) => {
      if (config.pushNodesNet == 'PROD') {
        // dont run the migration for prod. Just update the migrationversion in db
        resolve(true)
      }
      db.query(query1, [], function (err: any) {
        if (err) {
          crashWithError(err)
          reject(err)
        } else {
          db.query(query2, [], function (err: any) {
            if (err) {
              crashWithError(err)
              reject(err)
            } else {
              db.query(query3, [], function (err: any) {
                if (err) {
                  crashWithError(err)
                  reject(err)
                } else {
                  logger.info('Upgraded to version 46')
                  resolve(true)
                }
              })
            }
          })
        }
      })
    })
  }
  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 50 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
