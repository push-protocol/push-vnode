// Do Versioning
// Function
// upgrade() -> Runs for upgrading version
// downgrade() -> Runs for downgrading version
// Use this template upper functions to make this work well

// Version 1 is genesis and should be called
import { Container } from 'typedi'

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
    process.exit(1)
  }

  const upgradeScript = async () => {
    crashWithError("Upgrading... Version 1 is genesis, can't use, aborting!")
  }

  const downgradeScript = async () => {
    crashWithError("Downgrading... Version 1 is genesis, can't use, aborting!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
