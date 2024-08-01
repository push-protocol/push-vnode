import winston from 'winston'

import config from '../config'
import * as db from './dbHelper'
import { createNewValidatorTables } from '../migrations/versioned/migrationV42'

/**
 * Creates DB and Tables if they don't exist
 * @param logger winsotn logger
 */
export const generateDBStructure = async (logger: winston.Logger): Promise<void> => {
  // Create DB
  await generateDB(logger)
  await generateTableChannels(logger)
  await generateTableSubscribers(logger)
  await generateTableDelegate(logger)
  await generateTablePayloads(logger)
  await generateTableFeeds(logger)
  await generateTableFeedsUsers(logger)
  await generateTableServerTokens(logger)
  await generateTableProtocolMeta(logger)
  await insertDefaultsInProtocolMeta(logger)
  await generateTableNotifKeys(logger)
  await generateTableAPIKeys(logger)
  await generateTableGovernanceData(logger)
  await generateTableW2WMeta(logger)
  await generateTableW2W(logger)
  await generateSessionKeysGroupChat(logger)
  await generateChatMembers(logger)
  await generateChatMessages(logger)
  await generateGroupDeltaVerificationProof(logger)
  await generateChannelPrecache(logger)
  await generateTableAliases(logger)
  await generateTableTags(logger)
  await generateTableTaggables(logger)
  // VALIDATOR TABLES
  await generateValidatorTables(logger)
}
// CREATE DB IF NOT EXISTS
const generateDB = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE DATABASE IF NOT EXISTS ${config.dbname}`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('db creation       | Creation Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('db creation       | DB Exists')
        } else {
          logger.info('db creation       | DB Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableChannels = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS channels (
        id int(11) NOT NULL AUTO_INCREMENT,
        channel varchar(150) NOT NULL,
        ipfshash varchar(64) NOT NULL,
        name varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
        info varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
        url varchar(255) DEFAULT NULL,
        icon varchar(255) DEFAULT NULL,
        iconV2 text DEFAULT NULL,
        icon_migration INT NOT NULL DEFAULT '0',
        payload_migration INT NOT NULL DEFAULT '0',
        processed tinyint(1) NOT NULL DEFAULT '0',
        attempts int(11) NOT NULL,
        alias_address varchar(255) DEFAULT NULL,
        is_alias_verified tinyint(1) NOT NULL DEFAULT '0',
        blocked tinyint(1) NOT NULL DEFAULT '0',
        alias_verification_event json DEFAULT NULL,
        activation_status tinyint(1) NOT NULL DEFAULT '1',
        verified_status tinyint(1) NOT NULL DEFAULT '0',
        subgraph_details varchar(255) DEFAULT NULL,
        subgraph_attempts int(11) NOT NULL DEFAULT '0',
        counter int(11) DEFAULT NULL,
        timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        channel_settings json DEFAULT NULL,
        minimal_channel_settings varchar(255) DEFAULT NULL,
        initiate_verification_proof text DEFAULT NULL,
        verify_verification_proof text DEFAULT NULL,
        channel_id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY channel_id (channel_id),
        UNIQUE KEY address (channel)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('channels          | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('channels          | Table Exists')
        } else {
          logger.info('channels          | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableSubscribers = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS subscribers (
      id int(11) NOT NULL AUTO_INCREMENT,
      is_currently_subscribed tinyint DEFAULT 1,
      channel varchar(150) NOT NULL,
      alias varchar(150) DEFAULT NULL,
      subscriber varchar(150) NOT NULL,
      user_settings json DEFAULT NULL,
      minimal_user_settings varchar(255) DEFAULT NULL,
      signature varchar(150) DEFAULT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sub_timestamp timestamp default null,
      unsub_timestamp timestamp default null,
      PRIMARY KEY (id),
      UNIQUE KEY combined_channel_subscriber (channel,subscriber),
      origin varchar(255) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('subscribers       | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('subscribers       | Table Exists')
        } else {
          logger.info('subscribers       | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableDelegate = async (logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS delegates (
      id int(11) NOT NULL AUTO_INCREMENT,
      channel varchar(150) NOT NULL,
      delegate varchar(150) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY combined_channel_delegate (channel,delegate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('delegates         | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('delegates         | Table Exists')
        } else {
          logger.info('delegates         | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTablePayloads = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS payloads (
      id int(11) NOT NULL AUTO_INCREMENT,
      verification_proof varchar(600) NOT NULL,
      sender varchar(150) NOT NULL,
      sender_type smallint(4) NOT NULL DEFAULT '${config.senderType.channel}',
      recipient varchar(150) NOT NULL,
      storage_type int(11) NOT NULL,
      identity varchar(128) NOT NULL,
      og_payload json DEFAULT NULL,
      is_spam tinyint(1) NOT NULL DEFAULT '0',
      source varchar(128) DEFAULT NULL,
      processed tinyint(1) NOT NULL DEFAULT '0',
      attempts int(11) NOT NULL DEFAULT '0',
      timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      channel VARCHAR(150) DEFAULT NULL,
      delegate VARCHAR(150) DEFAULT NULL,
      UNIQUE KEY verification_proof (verification_proof),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('payloads          | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('payloads          | Table Exists')
        } else {
          logger.info('payloads          | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableFeeds = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS feeds (
    sid int(11) NOT NULL AUTO_INCREMENT COMMENT 'This is not a typo, sid of items delivered comes from here',
    payload_id int(11) NOT NULL,
    sender varchar(150) NOT NULL,
    sender_type smallint(4) NOT NULL DEFAULT '${config.senderType.channel}',
    users json NOT NULL,
    did varchar(255) DEFAULT NULL,
    feed_payload json DEFAULT NULL,
    is_spam tinyint(1) NOT NULL DEFAULT '0',
    source varchar(128) DEFAULT NULL,
    processed tinyint(1) NOT NULL DEFAULT '0',
    migrated tinyint(1) NOT NULL DEFAULT '0',
    attempts int(11) NOT NULL DEFAULT '0',
    epoch timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'This is epoch for the feed',
    hidden tinyint(1) NOT NULL DEFAULT '0',
    etime timestamp NULL DEFAULT NULL,
    channel varchar(150) DEFAULT NULL,
    delegate VARCHAR(150) DEFAULT NULL,
    PRIMARY KEY (sid),
    UNIQUE KEY payload_id (payload_id),
    INDEX idx_sender (sender),
    INDEX idx_channel (channel)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('feeds             | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('feeds             | Table Exists')
        } else {
          logger.info('feeds             | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableFeedsUsers = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS feeds_users (
      user varchar(150) NOT NULL,
      feed_sid json DEFAULT NULL,
      spam_sid json DEFAULT NULL,
      PRIMARY KEY (user)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('feeds_users       | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('feeds_users       | Table Exists')
        } else {
          logger.info('feeds_users       | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableServerTokens = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS servertokens (
      id int(11) NOT NULL AUTO_INCREMENT,
      server_token varchar(80) NOT NULL,
      for_wallet varchar(150) NOT NULL,
      secret varchar(15) NOT NULL,
      timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY for_wallet_2 (for_wallet),
      KEY for_wallet (for_wallet)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('servertokens      | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('servertokens      | Table Exists')
        } else {
          logger.info('servertokens      | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableProtocolMeta = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS protocol_meta (
      id int(11) NOT NULL AUTO_INCREMENT,
      type varchar(255) NOT NULL,
      value varchar(255) NOT NULL,
      UNIQUE KEY type (type),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('protocol_meta     | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('protocol_meta     | Table Exists')
        } else {
          logger.info('protocol_meta     | Table Created')
        }
        resolve(true)
      }
    })
  })
}
// INSERT VALUES TO PROTOCOL META IF NOT EXISTS
const insertDefaultsInProtocolMeta = async (logger: winston.Logger): Promise<boolean> => {
  let query = `
      INSERT IGNORE INTO protocol_meta (type, value) 
        VALUES
        ("${config.protocolMeta[0].row}_channel_block_number", "${config.protocolMeta[0].genesisBlock}"),`

  for (let i = 0; i < config.protocolMeta.length; i++) {
    query += `("${config.protocolMeta[i].row}_subscriber_block_number", "${config.protocolMeta[i].genesisBlock}"),
          ("${config.protocolMeta[i].row}_payload_block_number", "${config.protocolMeta[i].genesisBlock}"),`
  }
  query += `("migrationVersion", "${config.migrationVersion}"),
    ("awsSNSPublishLatestEpoch", "${config.awsSNSPublishLatestEpoch}");`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('protocol_meta     | Insert (insertDefaultsInProtocolMeta) Errored')
        reject(err)
      } else {
        if (results.warningCount !== 0) {
          logger.info('protocol_meta     | Insert (insertDefaultsInProtocolMeta) Exists')
        } else {
          logger.info('protocol_meta     | Insert (insertDefaultsInProtocolMeta) Created')
        }
        resolve(true)
      }
    })
  })
}

const generateTableNotifKeys = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS notif_keys (
      wallet varchar(255) NOT NULL,
      pgp_pub text NOT NULL,
      pgp_priv_enc text NOT NULL,
      pgp_enc_type text NOT NULL,
      verification_proof varchar(255) NOT NULL,
      timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (wallet)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('notif_key         | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('notif_key         | Table Exists')
        } else {
          logger.info('notif_key         | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableAPIKeys = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS api_keys(
    id int(11) NOT NULL AUTO_INCREMENT,
    prefix varchar(64) NOT NULL,
    key_hash varchar(255) NOT NULL,
    validity_up_to timestamp NOT NULL,
    timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    UNIQUE unique_prefix (prefix(32))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err: any, results: { warningCount: number }) {
      if (err) {
        logger.info('api_keys          | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('api_keys          | Table Exists')
        } else {
          logger.info('api_keys          | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableGovernanceData = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS governance_data(
    id int(11) NOT NULL AUTO_INCREMENT,
    governance_key varchar(64) NOT NULL,
    governance_data longtext NULL,
    PRIMARY KEY(id),
    UNIQUE unique_key (governance_key(32))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`
  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err: any, results: { warningCount: number }) {
      if (err) {
        logger.info('governance_data   | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('governance_data   | Table Exists')
        } else {
          logger.info('governance_data   | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableW2WMeta = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS w2w_meta (
    id int(11) unsigned NOT NULL AUTO_INCREMENT,
    did varchar(255) NOT NULL UNIQUE,
    wallets longtext,
    profile_picture varchar(512) DEFAULT NULL,
    about varchar(255) DEFAULT NULL,
    name varchar(255) DEFAULT NULL,
    pgp_pub text NOT NULL,
    pgp_priv_enc text NOT NULL,
    pgp_enc_type text NOT NULL,
    nft_owner varchar(255) DEFAULT NULL,
    signature text NOT NULL,
    sig_type text NOT NULL,
    num_msg int(11) unsigned DEFAULT '0',
    allowed_num_msg int(11) unsigned DEFAULT '0',
    timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verification_proof text,
    profile text,
    origin varchar(255) DEFAULT NULL,
    PRIMARY KEY (id),
    KEY did_idx (did)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8 `
  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err: any, results: { warningCount: number }) {
      if (err) {
        logger.info('w2w_meta          | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('w2w_meta          | Table Exists')
        } else {
          logger.info('w2w_meta          | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateTableW2W = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS w2w(
        id int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
        combined_did MEDIUMTEXT NOT NULL,
        threadhash varchar(255) NULL,
        intent MEDIUMTEXT NOT NULL,
        intent_sent_by varchar(255) NULL,
        intent_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        chat_id varchar(255) NULL,
        group_name varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
        group_description varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
        meta TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
        profile_picture LONGTEXT CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
        admins MEDIUMTEXT NULL,
        is_public TINYINT DEFAULT 0 NOT NULL,
        contract_address_nft varchar(255) NULL,
        number_of_nfts int(24) DEFAULT 0 NOT NULL,
        contract_address_erc20 varchar(255) NULL,
        number_of_erc20 int(24) DEFAULT 0 NOT NULL,
        verification_proof TEXT NULL,
        profile_verification_proof TEXT NULL,
        config_verification_proof TEXT NULL,
        timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        group_type varchar(255) DEFAULT 'default' NOT NULL,
        group_version ENUM('v1', 'v2') NOT NULL DEFAULT 'v1',
        schedule_at TIMESTAMP NULL,
        schedule_end TIMESTAMP NULL,
        status varchar(255) DEFAULT NULL,
        session_key MEDIUMTEXT DEFAULT NULL,
        rules TEXT DEFAULT NULL,
        PRIMARY KEY(id),
        UNIQUE KEY idx_chat_id (chat_id)
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8; `

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err: any, results: { warningCount: number }) {
      if (err) {
        logger.info('w2w               | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('w2w               | Table Exists')
        } else {
          logger.info('w2w               | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateSessionKeysGroupChat = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS session_keys (
    id int(11) NOT NULL AUTO_INCREMENT,
    session_key MEDIUMTEXT NOT NULL,
    encrypted_secret MEDIUMTEXT NOT NULL,
    timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;`
  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err: any, results: { warningCount: number }) {
      if (err) {
        logger.info('session_keys      | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('session_keys      | Table Exists')
        } else {
          logger.info('session_keys      | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateChatMembers = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS chat_members (
  id int(11) NOT NULL AUTO_INCREMENT,
  chat_id varchar(255) NOT NULL,
  address varchar(255) NOT NULL,
  role varchar(255) NOT NULL,
  intent tinyint(1) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY chat_address_unique (chat_id,address),
  KEY chat_id_idx (chat_id),
  KEY address_idx (address),
  KEY idx_chat_id_intent (chat_id,intent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;`
  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err: any, results: { warningCount: number }) {
      if (err) {
        logger.info('chat_members      | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('chat_members      | Table Exists')
        } else {
          logger.info('chat_members      | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateChatMessages = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS chat_messages (
    reference VARCHAR(255) PRIMARY KEY COMMENT 'Unique reference for each message',
    uid INT AUTO_INCREMENT COMMENT 'Unique identifier for each message, used as secondary key when timestamp clashes',
    chat_id VARCHAR(255) COMMENT 'Identifier for the chat',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'Timestamp when the message was sent',
    cid VARCHAR(255) NOT NULL COMMENT 'IPFS cid of a message',
    uploaded_to_ipfs BOOLEAN NOT NULL COMMENT 'Status indicating if the message is uploaded to IPFS',
    payload JSON COMMENT 'Used for storing message payload',
    UNIQUE KEY unique_uid (uid) COMMENT 'Ensures that uid is unique',
    UNIQUE KEY unique_cid (cid) COMMENT 'Ensures that cid is unique',
    INDEX idx_chat_id (chat_id) COMMENT 'Index for faster queries on chat_id',
    INDEX idx_chat_timestamp (chat_id, timestamp) COMMENT 'Composite index for queries involving chat_id and timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;`
  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err: any, results: { warningCount: number }) {
      if (err) {
        logger.info('chat_messages     | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('chat_messages     | Table Exists')
        } else {
          logger.info('chat_messages     | Table Created')
        }
        resolve(true)
      }
    })
  })
}
const generateGroupDeltaVerificationProof = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS group_delta_verification_proof (
    id int(11) NOT NULL AUTO_INCREMENT,
    chat_id VARCHAR(255) NOT NULL,
    signer VARCHAR(255) NOT NULL,
    verification_proof MEDIUMTEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    INDEX chat_id_idx (chat_id)
);
`
  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err: any, results: { warningCount: number }) {
      if (err) {
        logger.info('group_delta_vproof| Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('group_delta_vproof| Table Exists')
        } else {
          logger.info('group_delta_vproof| Table Created')
        }
        resolve(true)
      }
    })
  })
}

const generateChannelPrecache = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS channel_precache (
    id int(11) NOT NULL AUTO_INCREMENT,
    channel VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    channel_meta TEXT NOT NULL,
    PRIMARY KEY(id),
    UNIQUE KEY channel_address (channel),
    channel_meta_verification_proof TEXT NOT NULL
  )`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err: any, results: { warningCount: number }) {
      if (err) {
        logger.info('channel_precache| Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('channel_precache| Table Exists')
        } else {
          logger.info('channel_precache| Table Created')
        }
        resolve(true)
      }
    })
  })
}

const generateTableAliases = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS aliases (
    id int(11) NOT NULL AUTO_INCREMENT,
    channel varchar(150) NOT NULL,
    processed tinyint(1) NOT NULL DEFAULT '0',
    alias_address varchar(255) DEFAULT NULL,
    is_alias_verified tinyint(1) NOT NULL DEFAULT '0',
    alias_verification_event json DEFAULT NULL,
    timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    initiate_verification_proof TEXT DEFAULT NULL,
    verify_verification_proof TEXT DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY alias_address (alias_address)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('aliases          | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('aliases          | Table Exists')
        } else {
          logger.info('aliases          | Table Created')
        }
        resolve(true)
      }
    })
  })
}

const generateTableTags = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS Tags (
    id int(11) NOT NULL AUTO_INCREMENT,
    tag_name VARCHAR(150) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY tag_name (tag_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('tags          | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('tags          | Table Exists')
        } else {
          logger.info('tags          | Table Created')
        }
        resolve(true)
      }
    })
  })
}

const generateTableTaggables = async (logger: winston.Logger): Promise<boolean> => {
  const query = `CREATE TABLE IF NOT EXISTS Taggables (
    tag_id INT(11) NOT NULL,
    taggable_id VARCHAR(150) NOT NULL,
    taggable_type VARCHAR(150) NOT NULL,
    INDEX idx_tag_id (tag_id),
    INDEX idx_taggable_id (taggable_id),
    INDEX idx_taggable_type (taggable_type),
    UNIQUE INDEX idx_unique_tagging (tag_id, taggable_id, taggable_type),
    FOREIGN KEY (tag_id) REFERENCES Tags(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8;`

  return new Promise((resolve, reject) => {
    ;(db as any).query(query, [], function (err, results) {
      if (err) {
        logger.info('taggables          | Table Errored')
        reject(err)
      } else {
        if (results.warningCount === 1) {
          logger.info('taggables          | Table Exists')
        } else {
          logger.info('taggables          | Table Created')
        }
        resolve(true)
      }
    })
  })
}

async function generateValidatorTables(logger: { info: (arg0: string) => void }): Promise<void> {
  await createNewValidatorTables()
}
