import { Container } from 'typedi'

import * as dbGenerator from '../helpers/dbGeneratorHelper'
import { startMigration } from '../helpers/migrationsHelper'
import { startManualMigration } from '../migrations/manual'
import HistoryFetcherService from '../services/historyFetcherService'

export default async ({ logger, testMode }) => {
  logger.info('Running DB Checks')
  await dbGenerator.generateDBStructure(logger)
  logger.info('DB Checks completed!')

  logger.info('Running Migration')
  await startMigration()
  logger.info('Migration completed!')

  logger.info('Running Manual Migration')
  startManualMigration()

  logger.info('Syncing Protocol History')

  if (!testMode) {
    const historyFetcher = Container.get(HistoryFetcherService)
    // removed await so as not to wait till the process to be over
    historyFetcher.syncProtocolData()
  }

  logger.transports.forEach((t) => (t.silent = false))
  logger.info('Protocol History Synced!')
}
