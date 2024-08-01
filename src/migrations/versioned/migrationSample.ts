// Do Versioning
// Function
// upgrade() -> Runs for upgrading version
// downgrade() -> Runs for downgrading version
// Use this template upper functions to make this work well
import { Container } from 'typedi'

const utils = require('../../helpers/utilsHelper')

export default async (upgrade) => {
  const logger = Container.get('logger')
  const dynamicLogger = Container.get('dynamicLogger')

  const crashWithError = (err) => {
    dynamicLogger.updateFooterLogs(null)
    dynamicLogger.stopRendering()
    dynamicLogger.reset()
    logger.hijackLogger(null)

    logger.error(
      `🔥 Error executing [${
        upgrade ? 'Upgrade' : 'Downgrade'
      }] [${utils.getCallerFile()}] | err: ${err}`
    )
    // await new Promise(r => setTimeout(r, 1000));
    process.exit(1)
  }

  const upgradeScript = async () => {
    logger.info('Updated to version x')
  }

  const downgradeScript = async () => {
    logger.info('Downgraded from version x')
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
