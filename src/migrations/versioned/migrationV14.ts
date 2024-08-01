// Do Versioning
// Function
// upgradeScript() -> Runs for upgrading version
// downgradeScript() -> Runs for downgrading version
// Use this template upper functions to make this work well
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../config'
import {
  convertAddressToCaip,
  isValidCAIP10Address,
  isValidPartialCAIP10Address
} from '../../helpers/caipHelper'
import * as db from '../../helpers/dbHelper'
const utils = require('../../helpers/utilsHelper')

export default async (upgrade) => {
  const logger: Logger = Container.get('logger')
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

  const caipChannelsTableMigration = async () => {
    const query1 = 'ALTER TABLE `channels` MODIFY channel varchar(128) NOT NULL'
    const query2 = 'ALTER TABLE `channels` MODIFY alias_address varchar(255)'
    const query3 = `UPDATE channels SET channel = CONCAT("eip155:", "${config.ethereumChainId}" ,":", channel) WHERE LENGTH(channel) = 42`
    const query4 = `UPDATE channels SET alias_address = CONCAT("eip155:", "${config.polygonChainId}" ,":", alias_address) WHERE alias_address IS NOT NULL AND LENGTH(alias_address) = 42`
    // const query5 = 'ALTER TABLE `channels` DROP COLUMN `alias_blockchain_id`';

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          reject(err)
        } else {
          db.query(query2, [], function (err) {
            if (err) {
              reject(err)
            } else {
              db.query(query3, [], function (err) {
                if (err) {
                  reject(err)
                } else {
                  db.query(query4, [], function (err) {
                    if (err) {
                      reject(err)
                    } else {
                      resolve(true)
                      // db.query(query5, [], function (err) {
                      //         resolve(true);
                      // })
                    }
                  })
                }
              })
            }
          })
        }
      })
    })
  }

  const caipDelegatesTableMigration = async () => {
    const query1 = 'ALTER TABLE `delegates` MODIFY channel varchar(128) NOT NULL'
    const query2 = `UPDATE delegates SET channel = CONCAT("eip155:", "${config.ethereumChainId}" ,":", channel) where LENGTH(channel) = 42`

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          return reject(err)
        } else {
          db.query(query2, [], function (err) {
            if (err) {
              return reject(err)
            } else {
              return resolve(true)
            }
          })
        }
      })
    })
  }

  const caipFeedsTableMigration = async () => {
    const query1 = 'ALTER TABLE `feeds` MODIFY sender varchar(128) NOT NULL'

    await new Promise(async (resolve, reject) => {
      await db.query(query1, [], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })

    const limit = 5000
    let offset = 0
    const selectQuery =
      'SELECT sid, sender, users, source, feed_payload from feeds where LENGTH(sender) = 42 ORDER BY sid DESC LIMIT ? OFFSET ?'
    let moreResults = true
    let count = 0
    while (moreResults) {
      await new Promise(async (resolve, reject) => {
        logger.debug('Fetching feeds records with limit :: %o and offset :: %o', limit, offset)
        await db.query(selectQuery, [limit, offset], function (err, results) {
          if (err) {
            return reject(err)
          } else {
            return resolve(results)
          }
        })
      })
        .then(async (response) => {
          logger.debug('Number of feeds records fetched :: %o ', response.length)
          if (response.length == 0) {
            moreResults = false
          }
          for (let i = 0; i < response.length; i++) {
            count = count + 1
            const item = response[i]
            try {
              const validChains = [
                'ETH_TEST_GOERLI',
                'POLYGON_TEST_MUMBAI',
                'ETH_MAINNET',
                'POLYGON_MAINNET'
              ]

              if (!validChains.includes(item.source)) {
                logger.debug(item.source + ' is not applicable for migration hence skipping')
                continue
              }

              let caipSender

              if (!isValidCAIP10Address(item.sender)) {
                caipSender = convertAddressToCaip(
                  item.sender,
                  config.MAP_BLOCKCHAIN_STRING_TO_ID[item.source]
                ).result
              } else {
                caipSender = item.sender
              }

              const caipUser = []

              JSON.parse(item.users).map((each) => {
                if (!isValidPartialCAIP10Address(each)) {
                  caipUser.push('eip155:' + each)
                } else {
                  caipUser.push(each)
                }
              })

              const feedPayload = JSON.parse(item.feed_payload)
              if (feedPayload['recipients'] != null && feedPayload['recipients'] != undefined) {
                let caipReipients
                if (feedPayload['data']['type'] == 1) {
                  if (!isValidPartialCAIP10Address(feedPayload['recipients']))
                    caipReipients = 'eip155:' + feedPayload['recipients']
                  else caipReipients = feedPayload['recipients']
                } else if (feedPayload['data']['type'] == 3) {
                  const address = Object.keys(feedPayload['recipients'])[0]
                  if (!isValidPartialCAIP10Address(address)) {
                    const caipAddress = 'eip155:' + address
                    caipReipients = {}
                    caipReipients[caipAddress] = null
                  } else caipReipients = feedPayload['recipients']
                } else if (feedPayload['data']['type'] == 4) {
                  caipReipients = {}
                  Object.keys(feedPayload['recipients']).map((each) => {
                    if (!isValidPartialCAIP10Address(each)) {
                      const caipAddress = 'eip155:' + each
                      caipReipients[caipAddress] = null
                    } else caipReipients[each] = null
                  })
                }

                feedPayload['recipients'] = caipReipients
              }

              const updateQuery = 'UPDATE feeds set sender=?, users=?, feed_payload=? WHERE sid=?'
              await new Promise(async (resolve, reject) => {
                await db.query(
                  updateQuery,
                  [caipSender, JSON.stringify(caipUser), JSON.stringify(feedPayload), item.sid],
                  function (err, results) {
                    if (err) {
                      return reject(err)
                    } else {
                      return resolve(results)
                    }
                  }
                )
              })
                .then(async (response) => {
                  logger.debug('Updated the feeds record for sid :: %o', item.sid)
                })
                .catch((err) => {
                  logger.error(
                    'Error while updating the feeds record for sid :: %o Error :: %o',
                    item.sid,
                    err
                  )
                })
            } catch (err) {
              logger.error(err)
              logger.error('Error in caipCoversion of feeds table for id :: ' + item.sid)
            }
          }
        })
        .catch((err) => {
          logger.error(err)
          throw err
        })
      offset = offset + limit
    }
    return {
      success: 1
    }
  }

  const caipfeedUsersTableMigration = async () => {
    const query1 = 'ALTER TABLE `feeds_users` MODIFY user varchar(128) NOT NULL'
    const query2 = `UPDATE feeds_users SET user = CONCAT("eip155:", user) WHERE LENGTH(user) = 42`

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          reject(err)
        } else {
          db.query(query2, [], function (err) {
            if (err) {
              reject(err)
            } else {
              resolve(true)
            }
          })
        }
      })
    })
  }

  const caipPayloadsTableMigration = async () => {
    const query1 = 'ALTER TABLE `payloads` MODIFY sender varchar(128) NOT NULL'
    const query2 = 'ALTER TABLE `payloads` MODIFY recipient varchar(128) NOT NULL'

    await new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          reject(err)
        } else {
          db.query(query2, [], function (err) {
            if (err) {
              reject(err)
            } else {
              resolve(true)
            }
          })
        }
      })
    })

    const limit = 5000
    let offset = 0
    const selectQuery =
      'SELECT id, sender, recipient, source from payloads ORDER BY id DESC LIMIT ? OFFSET ?'
    let moreResults = true
    let count = 0
    while (moreResults) {
      await new Promise(async (resolve, reject) => {
        logger.debug('Fetching payloads records with limit :: %o and offset :: %o', limit, offset)
        await db.query(selectQuery, [limit, offset], function (err, results) {
          if (err) {
            return reject(err)
          } else {
            return resolve(results)
          }
        })
      })
        .then(async (response) => {
          logger.debug('Number of payloads records fetched :: %o ', response.length)
          if (response.length == 0) {
            moreResults = false
          }
          for (let i = 0; i < response.length; i++) {
            count = count + 1
            const item = response[i]
            try {
              const validChains = [
                'ETH_TEST_GOERLI',
                'POLYGON_TEST_MUMBAI',
                'ETH_MAINNET',
                'POLYGON_MAINNET'
              ]

              if (!validChains.includes(item.source)) {
                logger.debug(item.source + ' is not applicable for migration hence skipping')
                continue
              }

              let caipSender = item.sender
              let caipRecipient = item.recipient

              if (!isValidCAIP10Address(item.sender)) {
                caipSender = convertAddressToCaip(
                  item.sender,
                  config.MAP_BLOCKCHAIN_STRING_TO_ID[item.source]
                ).result
              } else {
                caipSender = item.sender
              }

              if (!isValidPartialCAIP10Address(item.recipient)) {
                caipRecipient = 'eip155:' + item.recipient
              } else {
                caipRecipient = item.recipient
              }

              const updateQuery = 'UPDATE payloads set sender=?, recipient=? WHERE id=?'
              await new Promise(async (resolve, reject) => {
                await db.query(
                  updateQuery,
                  [caipSender, caipRecipient, item.id],
                  function (err, results) {
                    if (err) {
                      return reject(err)
                    } else {
                      return resolve(results)
                    }
                  }
                )
              })
                .then(async (response) => {
                  logger.debug('Updated the payloads record for id :: %o', item.id)
                })
                .catch((err) => {
                  logger.error(
                    'Error while updating the payloads record for id :: %o Error :: %o',
                    item.id,
                    err
                  )
                })
            } catch (err) {
              logger.error(err)
              logger.error('Error in caipCoversion of payloads table for id :: ' + item.id)
            }
          }
        })
        .catch((err) => {
          logger.error(err)
          throw err
        })
      offset = offset + limit
    }
    logger.debug('caipPayloadsTableMigration Finished. Total records processed :: ' + count)
    return {
      success: 1
    }
  }

  const caipSubscribersTableMigration = async () => {
    const query1 = 'ALTER TABLE `subscribers` MODIFY channel varchar(128) NOT NULL'
    const query2 = 'ALTER TABLE `subscribers` MODIFY alias varchar(128)'
    const query3 = 'ALTER TABLE `subscribers` MODIFY subscriber varchar(128) NOT NULL'
    const query4 = `UPDATE subscribers SET channel = CONCAT("eip155:", "${config.ethereumChainId}" ,":", channel) where LENGTH(channel) = 42`
    const query5 = `UPDATE subscribers SET alias = CONCAT("eip155:", "${config.polygonChainId}" ,":", alias) where alias IS NOT NULL AND LENGTH(alias) = 42`
    const query6 = `UPDATE subscribers SET subscriber = CONCAT("eip155:", subscriber) where LENGTH(subscriber) = 42`

    await new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          return reject(err)
        } else {
          db.query(query2, [], function (err) {
            if (err) {
              reject(err)
            } else {
              db.query(query3, [], function (err) {
                if (err) {
                  reject(err)
                } else {
                  db.query(query4, [], function (err) {
                    if (err) {
                      reject(err)
                    } else {
                      db.query(query5, [], function (err) {
                        if (err) {
                          reject(err)
                        } else {
                          db.query(query6, [], function (err) {
                            if (err) {
                              reject(err)
                            } else {
                              resolve(true)
                            }
                          })
                        }
                      })
                    }
                  })
                }
              })
            }
          })
        }
      })
    })
  }

  const caipPushTokenTableMigration = async () => {
    const query1 = 'ALTER TABLE `pushtokens` MODIFY wallet varchar(128) NOT NULL'
    const query2 = `UPDATE pushtokens SET wallet = CONCAT("eip155:", wallet) where LENGTH(wallet) = 42`

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          return reject(err)
        } else {
          db.query(query2, [], function (err) {
            if (err) {
              return reject(err)
            } else {
              return resolve(true)
            }
          })
        }
      })
    })
  }

  const caipProtocolMetaTableMigration = async () => {
    const query1 = `DELETE from protocol_meta WHERE type = "${config.ethereumId}_channel_block_number" OR type = "${config.ethereumId}_subscriber_block_number" OR type = "${config.ethereumId}_payload_block_number" OR type = "${config.polygonId}_payload_block_number" OR type = "${config.polygonId}_subscriber_block_number"`
    const query2 = `UPDATE protocol_meta SET type = "${config.ethereumId}_channel_block_number" WHERE type = "${config.supportedSourceTypes[0]}_channel_block_number"`
    const query3 = `UPDATE protocol_meta SET type = "${config.ethereumId}_subscriber_block_number" WHERE type = "${config.supportedSourceTypes[0]}_subscriber_block_number"`
    const query4 = `UPDATE protocol_meta SET type = "${config.ethereumId}_payload_block_number" WHERE type = "${config.supportedSourceTypes[0]}_payload_block_number"`
    const query5 = `UPDATE protocol_meta SET type = "${config.polygonId}_payload_block_number" WHERE type = "${config.supportedSourceTypes[1]}_payload_block_number"`
    const query6 = `UPDATE protocol_meta SET type = "${config.polygonId}_subscriber_block_number" WHERE type = "${config.supportedSourceTypes[1]}_subscriber_block_number"`

    return new Promise((resolve, reject) => {
      db.query(query1, [], function (err) {
        if (err) {
          return reject(err)
        } else {
          db.query(query2, [], function (err) {
            if (err) {
              return reject(err)
            } else {
              db.query(query3, [], function (err) {
                if (err) {
                  return reject(err)
                } else {
                  db.query(query4, [], function (err) {
                    if (err) {
                      return reject(err)
                    } else {
                      db.query(query5, [], function (err) {
                        if (err) {
                          return reject(err)
                        } else {
                          db.query(query6, [], function (err) {
                            if (err) {
                              return reject(err)
                            } else {
                              resolve(true)
                            }
                          })
                        }
                      })
                    }
                  })
                }
              })
            }
          })
        }
      })
    })
  }

  const upgradeScript = async () => {
    try {
      // logger.debug('caipChannelsTableMigration Started');
      // await caipChannelsTableMigration();
      // logger.debug('caipChannelsTableMigration Finished');
      // logger.debug('caipDelegatesTableMigration Started');
      // await caipDelegatesTableMigration();
      // logger.debug('caipDelegatesTableMigration Finished');
      logger.debug('caipFeedsTableMigration Started')
      await caipFeedsTableMigration()
      logger.debug('caipFeedsTableMigration Finished')
      // logger.debug('caipfeedUsersTableMigration Started');
      // await caipfeedUsersTableMigration();
      // logger.debug('caipfeedUsersTableMigration Finished');
      // logger.debug('caipPayloadsTableMigration Started');
      // await caipPayloadsTableMigration();
      // logger.debug('caipPayloadsTableMigration Finished');
      // logger.debug('caipSubscribersTableMigration Started');
      // await caipSubscribersTableMigration();
      // logger.debug('caipSubscribersTableMigration Finished');
      // logger.debug('caipPushTokenTableMigration Started');
      // await caipPushTokenTableMigration();
      // logger.debug('caipPushTokenTableMigration Finished');
      // logger.debug('caipProtocolMetaTableMigration Started');
      // await caipProtocolMetaTableMigration();
      // logger.debug('caipProtocolMetaTableMigration Finished');
    } catch (err) {
      crashWithError(err)
    }
  }

  const downgradeScript = async () => {
    crashWithError("Can't downgrade... Version 14 is breaking changes!")
  }

  upgrade ? await upgradeScript() : await downgradeScript()
}
