// import {MySqlUtil} from '../../utilz/mySqlUtil'
//
//
//
// export async function createNewValidatorTables() {
//   await MySqlUtil.update(`
//       CREATE TABLE IF NOT EXISTS dset_client
//       (
//           id              INT          NOT NULL AUTO_INCREMENT,
//           queue_name      varchar(32)  NOT NULL COMMENT 'target node queue name',
//           target_node_id  varchar(128) NOT NULL COMMENT 'target node eth address',
//           target_node_url varchar(128) NOT NULL COMMENT 'target node url, filled from the contract',
//           target_offset   bigint(20)   NOT NULL DEFAULT 0 COMMENT 'initial offset to fetch target queue',
//           state           tinyint(1)   NOT NULL DEFAULT 1 COMMENT '1 = enabled, 0 = disabled',
//           PRIMARY KEY (id),
//           UNIQUE KEY uniq_dset_name_and_target (queue_name, target_node_id)
//       ) ENGINE = InnoDB
//         DEFAULT CHARSET = utf8;
//   `)
//
//   await MySqlUtil.update(`
//       CREATE TABLE IF NOT EXISTS dset_queue_mblock
//       (
//           id          BIGINT       NOT NULL AUTO_INCREMENT,
//           object_hash VARCHAR(255) NULL COMMENT 'optional: a uniq field to fight duplicates',
//           object      MEDIUMTEXT   NOT NULL,
//           PRIMARY KEY (id),
//           UNIQUE KEY uniq_mblock_object_hash (object_hash)
//       ) ENGINE = InnoDB
//         DEFAULT CHARSET = utf8;
//   `)
//
//   await MySqlUtil.update(`
//       CREATE TABLE IF NOT EXISTS dset_queue_subscribers
//       (
//           id          BIGINT       NOT NULL AUTO_INCREMENT,
//           object_hash VARCHAR(255) NULL COMMENT 'optional: a uniq field to fight duplicates',
//           object      MEDIUMTEXT   NOT NULL,
//           PRIMARY KEY (id)
//       ) ENGINE = InnoDB
//         DEFAULT CHARSET = utf8;
//   `);
//
//   // todo add good comments
//   await MySqlUtil.update(`
//       CREATE TABLE IF NOT EXISTS tx_status
//       (
//           hash VARCHAR(100),
//           status VARCHAR(32) NOT NULL COMMENT '',
//           status      MEDIUMTEXT   NOT NULL,
//           PRIMARY KEY (hash)
//       ) ENGINE = InnoDB
//         DEFAULT CHARSET = utf8;
//   `)
//
//
// }