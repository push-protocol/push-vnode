import { Container } from 'typedi'
import { Logger } from 'winston'
import { DynamicLogger } from '../../loaders/dynamicLogger'
import { Check } from '../../utilz/check'
import { MySqlUtil } from '../../utilz/mySqlUtil'
import * as dbHelper from '../../helpers/dbHelper'

const utils = require('../../helpers/utilsHelper')
/*
How it works:

Our migration logic is split into 2 main tasks:

1) dbGeneratorHelper.ts executes a clean db installation if no db is found
->calls createNewValidatorTables to create fresh tables

2) migrationsHelper.ts executes an incremental db update if some db is found
checks: config-general.ts , migrationVersion
checks: src/migrations/versioned/migrationV__.ts
checks: MySQL: protocol_meta

Based on this, if config.version > db.version
this default function can be invoked
->calls default function (migrate)

*/

function crashWithError(logger, upgrade: boolean, err) {
  const dynamicLogger: DynamicLogger = Container.get('dynamicLogger')
  dynamicLogger.updateFooterLogs(null)
  dynamicLogger.stopRendering()
  dynamicLogger.reset()
  logger.hijackLogger(null)
  logger.error(
    `🔥 Error executing [${
      upgrade ? 'Upgrade' : 'Downgrade'
    }] [${utils.getCallerFile()}] | err: ${err}`,
    err
  )
  process.exit(1)
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

// 2 UPDATE TABLES FROM V41
export default async (upgrade) => {
  const logger: Logger = Container.get('logger')
  try {
    logger.info('running migration V42')
    Check.isTrue(upgrade, 'downgrade is not supported')

    await MySqlUtil.update(`ALTER TABLE w2w ADD rules TEXT `);

    await createNewValidatorTables()

    await MySqlUtil.update(`
        alter table subscribers
            add column sub_timestamp timestamp default null;
    `)

    await MySqlUtil.update(`
        alter table subscribers
            add column unsub_timestamp timestamp default null;
    `)

    await MySqlUtil.update(`
        update subscribers
        set sub_timestamp = timestamp
        where is_currently_subscribed = 1;
    `)

    await MySqlUtil.update(`
        update subscribers
        set unsub_timestamp = timestamp
        where is_currently_subscribed = 0;
    `)
  } catch (e) {
    crashWithError(logger, upgrade, e)
  }
}
