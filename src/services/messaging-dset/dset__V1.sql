/*
Stores client state, for every queue X source_node X offset
Example:
we are reading queue named 'subs' from nodes 'v1' and 'v2'.
v1 read offset is 0 (we've never tried to read anything)
v2 read offset is 100 (and we will read up to 200 offset)
*/
DROP TABLE IF EXISTS dset_client;
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

/*
Stores an append only queue, one per every dset
 */
DROP TABLE IF EXISTS dset_queue_subscribers;
CREATE TABLE IF NOT EXISTS dset_queue_subscribers
(
    id     BIGINT     NOT NULL AUTO_INCREMENT,
    object MEDIUMTEXT NOT NULL,
    PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8;


DROP TABLE IF EXISTS dset_server;


alter table subscribers add column sub_timestamp timestamp default null;
alter table subscribers add column unsub_timestamp timestamp default null;
update subscribers set sub_timestamp = timestamp where is_currently_subscribed=1;
update subscribers set unsub_timestamp = timestamp where is_currently_subscribed=0;


DROP TABLE IF EXISTS dset_queue_mblock;
CREATE TABLE IF NOT EXISTS dset_queue_mblock
(
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    object_hash VARCHAR(255) NULL COMMENT 'optional: a uniq field to fight duplicates',
    object      MEDIUMTEXT   NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_mblock_object_hash (object_hash)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8;

alter table dset_queue_subscribers add column object_hash VARCHAR(255) NULL COMMENT 'optional: a uniq field to fight duplicates';

-- MOCK DATA
# INSERT INTO dset_client (id, queue_name, target_node_id, target_node_url, target_offset) VALUES (1, 'subscribers', '0x8e12dE12C35eABf35b56b04E53C4E468e46727E8', 'http://localhost:4001', 0);
# INSERT INTO dset_client (id, queue_name, target_node_id, target_node_url, target_offset) VALUES (2, 'subscribers', '0xfDAEaf7afCFbb4e4d16DC66bD2039fd6004CFce8', 'http://localhost:4002', 0);
