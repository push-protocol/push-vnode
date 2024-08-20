import { Container } from 'typedi'

// import * as dbGenerator from '../helpers/dbGeneratorHelper'
import { startMigration } from '../helpers/migrationsHelper'
import { startManualMigration } from '../migrations/manual'
import HistoryFetcherService from '../services/historyFetcherService'
// import {createNewValidatorTables} from "../migrations/versioned/migrationV1";
import {MySqlUtil} from "../utilz/mySqlUtil";
import * as dbHelper from "../helpers/dbHelper";

export default async ({ logger, testMode }) => {
  logger.info('Running DB Checks');
  // await dbGenerator.generateTableProtocolMeta(logger);
  // VALIDATOR TABLES ONLY
  await createNewValidatorTables();

  // COMMENTED OUT - I don't need tables
  // await dbGenerator.generateDBStructure(logger)
  // logger.info('DB Checks completed!')

  // logger.info('Running Migration')
  // await startMigration()
  // logger.info('Migration completed!')

  // logger.info('Running Manual Migration')
  // startManualMigration()

  logger.info('Syncing Protocol History')

  if (!testMode) {
    const historyFetcher = Container.get(HistoryFetcherService)
    // removed await so as not to wait till the process to be over
    historyFetcher.syncProtocolData()
  }

  logger.transports.forEach((t) => (t.silent = false))
  logger.info('Protocol History Synced!')
}


// 1 CREATE TABLES FROM SCRATCH
export async function createNewValidatorTables() {
  MySqlUtil.init(dbHelper.pool)

  await MySqlUtil.update(`
      CREATE TABLE IF NOT EXISTS dset_client
      (
          id              INT          NOT NULL AUTO_INCREMENT,
          queue_name      varchar(32)  NOT NULL COMMENT 'target node queue name',
          target_node_id  varchar(128) NOT NULL COMMENT 'target node eth address',
          target_node_url varchar(128) NOT NULL COMMENT 'target node url, filled from the contract',
          target_offset   bigint(20)   NOT NULL DEFAULT 0 COMMENT 'initial offset to fetch target queue',
          state           tinyint(1)   NOT NULL DEFAULT 1 COMMENT '1 = enabled, 0 = disabled',
          PRIMARY KEY (id),
          UNIQUE KEY uniq_dset_name_and_target (queue_name, target_node_id)
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8;
  `)

  await MySqlUtil.update(`
      CREATE TABLE IF NOT EXISTS dset_queue_mblock
      (
          id          BIGINT       NOT NULL AUTO_INCREMENT,
          object_hash VARCHAR(255) NULL COMMENT 'optional: a uniq field to fight duplicates',
          object      MEDIUMTEXT   NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_mblock_object_hash (object_hash)
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8;
  `)

  await MySqlUtil.update(`
      CREATE TABLE IF NOT EXISTS dset_queue_subscribers
      (
          id          BIGINT       NOT NULL AUTO_INCREMENT,
          object_hash VARCHAR(255) NULL COMMENT 'optional: a uniq field to fight duplicates',
          object      MEDIUMTEXT   NOT NULL,
          PRIMARY KEY (id)
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8;
  `)
}
