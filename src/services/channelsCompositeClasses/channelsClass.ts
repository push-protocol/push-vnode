import { MD5 } from 'crypto-js'
import Container, { Service, Inject } from 'typedi'
import config from '../../config'
import { TaggableTypes } from '../../enums/TaggableTypes'
import * as caipHelper from '../../helpers/caipHelper'
//import { query } from 'express';
import { promisify } from 'util'
import { reject } from 'lodash'
//import { resolve } from 'dns';
import { restrictAPICall } from '../../helpers/restrictAPICallHelper'
import { getSubgraphCounter } from '../../helpers/subgraphHelper'
import { ethers } from 'ethers'
import IPFSClient from '../../helpers/ipfsClient'
import * as ipfs from '../../helpers/ipfsClient'
import Alias from './aliasClass'
import ChannelPrecache from './precacheChannel'
import Subscribers from './subscribersClass'
import { scheduleTask, secondsToHms } from '../../loaders/subGraphJobs'
import { parseChannelSetting } from '../../helpers/utilsHelper'
import fs from 'fs'
import * as db from '../../helpers/dbHelper'
import epnsAPIHelper from '../../helpers/epnsAPIHelper'
import { isValidAddress } from '../../helpers/utilsHelper'
import {EnvLoader} from "../../utilz/envLoader";

const VALID_SUBGRAPH_FIELDS = ['subgraph_attempts', 'counter']
const CHANGED_NOTIFCIATION_SETTING_DELIMITER = '+'
const CHANGED_NOTIFICATION_SEPARATER = ':'
const CHANNEL_ICON_PREFIX = 'channel-icon:'
const publicDir = `${config.staticCachePath}/channels/`

const writeFilePromise = promisify(fs.writeFile)
const mkdirPromise = promisify(fs.mkdir)
@Service('channelObject')
export default class Channel {
  constructor(@Inject('logger') private logger) {}

  // To get a channel meta
  public async getChannel(channel: String): Promise<ChannelRecord> {
    const logger = this.logger
    logger.debug('Trying to get channel info for channel: ' + channel)
    const query = `SELECT *, (SELECT COUNT(*) FROM subscribers WHERE subscribers.channel = channels.channel and subscribers.is_currently_subscribed=1) AS subscriber_count FROM channels WHERE channel = ? LIMIT 1`

    return await new Promise<ChannelRecord>((resolve, reject) => {
      db.query(query, [channel], function (err: any, results: string | any[]) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            logger.info('Completed getChannel()')
            resolve(results[0])
          } else {
            logger.info('Completed getChannel() with no result')
            resolve(null)
          }
        }
      })
    })
  }

  public async addChannel(channel: any, channelType: any, identityBytes: any) {
    const logger = this.logger

    const query =
      'INSERT INTO channels (channel, ipfshash, attempts, processed, channel_id) VALUES (?, ?, ?, ?, ?);'

    const attempts = 0
    const processed = 0

    return await new Promise(async (resolve, reject) => {
      const channelMeta = epnsAPIHelper.interpretChannelIdentity(channel, identityBytes)
      if (!channelMeta.success)
        reject('Unable to interpret identity, raw channel meta: %o', channelMeta)

      logger.debug(
        'Trying to add channel: %s with identity: %s',
        channelMeta.channel,
        channelMeta.storageHash
      )
      let channelInCAIP = null
      // If not in CAIP, convert it to caip
      if (!caipHelper.isValidCAIP(channel)) {
        channelInCAIP = caipHelper.caipConversionByID(channelMeta.channel, config.ethereumChainId)
      } else {
        channelInCAIP = channelMeta.channel
      }
      const channelId = MD5(
        ethers.utils.getAddress(caipHelper.convertCaipToAddress(channelInCAIP).result)
      ).toString()
      db.query(
        query,
        [channelInCAIP, channelMeta.storageHash, attempts, processed, channelId],
        function (err: any, results: unknown) {
          if (err) {
            logger.error(err)
            reject(err)
          } else {
            logger.info('Completed addChannel()')
            resolve(results)
          }
        }
      )
    })
  }

  // 🔥 🔥 IMPORTANT: INTERNAL METHOD / DO NOT USE
  public async _deleteChannel(channel: string, identityBytes: any) {
    // IMPORTANT: THIS CALL IS RESTRICTED FOR TEST CASES ONLY //
    restrictAPICall('/tests/', '/src/')

    // Call private method
    await this.deleteChannel(channel)
  }

  private async deleteChannel(channel: string) {
    const logger = this.logger
    const query = 'DELETE from channels where channel = ?'
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          logger.info('Completed deleteChannel() for Channel: %s', channel)
          resolve(true)
        }
      })
    })
  }

  public async updateChannel(channel: any, identityBytes: any) {
    const logger = this.logger
    const query = 'UPDATE channels SET ipfshash=?, attempts=0, processed=0 WHERE channel=?'

    return await new Promise((resolve, reject) => {
      const channelMeta = epnsAPIHelper.interpretChannelIdentity(channel, identityBytes)
      if (!channelMeta.success)
        reject('Unable to interpret identity, raw channel meta: %o', channelMeta)
      // if(!isValidAddress(channel) )reject(`Not A valid ethereum address: ${channel}`);
      if (!caipHelper.isValidCAIP(channel)) reject(`Not A valid ethereum caip address: ${channel}`)
      logger.debug(
        'Trying to  update channel: %s with identity: %s',
        channelMeta.channel,
        channelMeta.storageHash
      )

      db.query(query, [channelMeta.storageHash, channel], function (err: any, results: unknown) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.info('Completed updateChannel()')
          resolve(results)
        }
      })
      this.processChannelData(channel, channelMeta.storageHash)
    })
  }

  // for processing ipfshash in batches of 50
  public async batchProcessChannelData() {
    if (EnvLoader.getPropertyAsBool('VALIDATOR_DISABLE_ALL_SERVICES')) {
      return;
    }
    const logger = this.logger
    logger.debug('Trying to batch process all channels data processing, 50 requests at a time')

    const query =
      'SELECT channel, ipfshash FROM channels WHERE processed=0 AND attempts<? ORDER BY attempts ASC, timestamp DESC LIMIT 50'
    return await new Promise((resolve, reject) => {
      db.query(query, [config.ipfsMaxAttempts], function (err: any, results: unknown) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed batchProcessChannelData()')

        // Now Loop the channel data
        for (const item of response) {
          this.processChannelData(item.channel, item.ipfshash)
            .then((response) => {
              logger.info(
                'Completed for batch process of processChannelData() for channel: ' + item.channel
              )
              return true
            })
            .catch((err) => {
              logger.error(
                'Error for batch process of processChannelData() for channel: ' + item.channel,
                err
              )
            })
        }

        // Finally return success
        return { success: 1 }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  private async resolveIpfsHash(ipfshash: string) {
    const logger = this.logger
    logger.info('Retrieving the file from ipfs: ' + ipfshash)
    const obj = await IPFSClient.get(ipfshash)
    logger.info('Retrieved Object' + obj['name'] + '\nInfo: ' + obj['info'])
    return obj
  }

  // for processing ipfshash
  public async processChannelData(channel: string, ipfshash: string) {
    const logger = this.logger
    logger.debug(
      'Trying to retrieve and process ipfshash for channel: ' + channel + ' and ipfs: ' + ipfshash
    )

    // Set valid flag for rest of logic
    let valid = true

    let obj: { [x: string]: any }
    let err: any

    const channelPrecacheObj = Container.get(ChannelPrecache)
    const channelPreCache = await channelPrecacheObj.getChannelMeta(channel)
    // 1. check if channel precache exists for the channel
    // 2. if yes, check if the ipfs generated matches with the ipfs hash that was passed.
    // 3. if yes, proceed with channel meta
    // 4. else fallback to ipfs
    try {
      if (!channelPreCache) {
        obj = await this.resolveIpfsHash(ipfshash)
        logger.info(`Channel ${channel} was not found in precache . Proceeding with ipfs`)
      } else {
        logger.info(`Channel ${channel} was found in precache `)
        const generatedIpfsHash = await ipfs.default.uploadToIfuraIpfs(JSON.stringify(obj))
        if (ipfshash != generatedIpfsHash) {
          logger.error(
            'Ipfs hash generated from channel meta did not match with the ipfs, proceeding with resolving ipfs'
          )
          obj = await this.resolveIpfsHash(ipfshash)
        }
        obj = channelPreCache.channelMeta
      }
    } catch (e) {
      valid = false
      logger.error(e)
      err = e
    }

    let iconUrl: string
    if (valid) {
      // Convert and process to saving image
      try {
        const channelAddress = caipHelper.convertCaipToAddress(channel).result
        // LOGIC TO STORE THE IMAGE IN SERVER CACHE (AWS)
        // const matches = obj['icon'].match(/^data:image\/(png|jpe?g);base64,(.+)/)
        // const iconType = matches[1] // Image extension (png, jpg, or jpeg)
        // const base64Content = matches[2] // Base64 image content
        // const filePath = path.join(publicDir, fileName)
        // const fileBuffer = Buffer.from(base64Content, 'base64')
        // await mkdirPromise(publicDir, { recursive: true })
        // await writeFilePromise(filePath, fileBuffer)
        iconUrl = `${config.backendURL}/apis/v1/channels/icon/${channelAddress}`
        // filename = await utils.writeBase64File(obj['icon'], ipfshash);
        // iconIpfshash = (await uploadToIPFS(obj['icon'])).cid
        // logger.info('File written to:' + filename);

        // if (!iconUrl) {
        //   valid = false
        //   throw 'Image not found'
        // }
      } catch (e) {
        valid = false
        logger.error(e)
        err = e
      }
    }
    //To take care of channel with alias
    //Only Support Polygon
    //@TODO Multichain support through CAIP
    let aliasAddress = null
    let aliasBlockchainId = null

    //New Channel Payload
    if (valid && 'aliasDetails' in obj) {
      //support only 1 alias
      for (let i = 0; i < config.supportedAliasIds.length; i++) {
        aliasAddress = obj['aliasDetails'][config.supportedAliasIds[i]]
          ? obj['aliasDetails'][config.supportedAliasIds[i]]
          : aliasAddress
        aliasBlockchainId = obj['aliasDetails'][config.supportedAliasIds[i]]
          ? config.MAP_BLOCKCHAIN_TO_ID[config.supportedAliasIds[i]]
          : aliasBlockchainId
      }
    }
    //Old Channel Payload
    else if (valid && 'blockchain' in obj && 'chain_id' in obj && 'address' in obj) {
      aliasAddress = obj['address'] && isValidAddress(obj['address']) ? obj['address'] : null
      aliasBlockchainId = obj['chain_id'] ? obj['chain_id'] : null
    }

    // Finally insert everything to server if valid or update attempt count if invalid
    if (valid) {
      aliasAddress =
        aliasAddress && aliasAddress != 'NULL'
          ? caipHelper.convertAddressToCaip(aliasAddress, aliasBlockchainId).result
          : aliasAddress
      try {
        await this.populateChannelData(
          channel,
          obj['name'],
          obj['info'],
          obj['url'],
          iconUrl,
          obj['icon']
        )

        await this.populateTagsData(channel, obj['tags'])
        await this.populateAliasData(channel, aliasAddress, aliasBlockchainId)

        logger.info('Completed processChannelInfo()')
        return {
          success: 1,
          name: obj['name'],
          info: obj['info'],
          url: obj['url'],
          icon: iconUrl,
          iconV2: obj['icon'],
          aliasAddress: aliasAddress,
          aliasBlockchainId: aliasBlockchainId
        }
      } catch (err) {
        valid = false
        logger.error(err)
        err = err
      }
    }

    // Last valid check and throw
    if (!valid) {
      // Write attempt number before erroring out
      try {
        await this.bumpAttemptCount(channel)
      } catch (e) {
        logger.error(err)
        throw err
      }

      logger.error(err)
      throw err
    }
  }

  private async populateAliasData(
    channel: string,
    aliasAddress: string | null,
    aliasBlockchainId: number | null
  ): Promise<string | null> {
    const logger = this.logger
    aliasAddress = aliasAddress
    aliasBlockchainId = aliasBlockchainId

    logger.debug(
      'Trying to add alias address: ' +
        aliasAddress +
        ' and alias blockchain id: ' +
        aliasBlockchainId +
        ' for channel: ' +
        channel
    )

    if (aliasAddress) {
      const query = 'INSERT INTO aliases SET alias_address=?, processed=1, channel=?'

      return await new Promise((resolve, reject) => {
        db.query(query, [aliasAddress, channel], function (err: any, results: unknown) {
          if (err) {
            return reject(err)
          } else {
            return resolve(results)
          }
        })
      })
        .then((response) => {
          logger.info('Completed populateAliasData(): %o', response)
          return aliasAddress
        })
        .catch((err) => {
          logger.error(err)
          throw null
        })
    } else {
      return null
    }
  }

  private async populateTagsData(channel: string, tags: Array<string>) {
    const logger = this.logger
    logger.debug('Trying to add tags: ' + tags + ' for channel: ' + channel)
    if(tags==null) {
      tags = [];
    }
    if (tags.length > 5) {
      tags = tags.slice(0, 5)
    }

    if (tags.join('').length > 512) {
      throw new Error(
        'Tags exceed the allow character limit of 512 characters for the channel ' + channel
      )
    }

    const resp = await this.removeChannelTags(channel)
    if (!resp) {
      throw new Error('Error in updating tags for channel ' + channel)
    }

    tags = tags.filter((tag) => tag !== '')

    if (tags.length > 0) {
      const query = 'INSERT INTO Taggables (tag_id, taggable_id, taggable_type) VALUES (?, ?, ?)'

      for (const tag of tags) {
        const tagId = await this.getOrCreateTagId(tag)
        if (tagId) {
          await new Promise((resolve, reject) => {
            db.query(
              query,
              [tagId, channel, TaggableTypes.Channel],
              function (err: any, result: unknown) {
                if (err) {
                  return reject(err)
                }

                return resolve(result)
              }
            )
          })
        } else {
          throw new Error('Error in getting or creating tag id')
        }
      }
    }
  }

  private async getOrCreateTagId(tagName: string) {
    const logger = this.logger
    const selectQuery = 'SELECT id FROM Tags WHERE tag_name = ?'
    const insertQuery = 'INSERT INTO Tags (tag_name) VALUES (?)'

    return await new Promise((resolve, reject) => {
      db.query(selectQuery, [tagName], function (err: any, result: unknown) {
        if (err) {
          return reject(new Error(err))
        }

        if (result.length > 0) {
          return resolve(result[0].id)
        } else {
          db.query(insertQuery, [tagName], function (err: any, response: unknown) {
            if (err) {
              return reject(new Error(err))
            }

            return resolve(response.insertId)
          })
        }
      })
    })
  }

  private async removeChannelTags(channel: string) {
    const logger = this.logger
    const query = 'DELETE from Taggables where taggable_id = ? and taggable_type = ?'

    return await new Promise((resolve, reject) => {
      db.query(query, [channel, TaggableTypes.Channel], function (err: any, result: unknown) {
        if (err) return false
        return resolve(true)
      })
    })
      .then((response) => {
        logger.info('Completed removeChannelTags()')
        return true
      })
      .catch((err) => {
        logger.error(err)
        return false
      })
  }

  // 🔥 🔥 IMPORTANT: INTERNAL METHOD / DO NOT USE
  public async _populateChannelData(
    channel: string,
    name: string,
    info: string,
    url: string,
    icon: string,
    iconV2: string,
    aliasAddress: any,
    aliasBlockchainId: any
  ) {
    // IMPORTANT: THIS CALL IS RESTRICTED FOR TEST CASES ONLY //
    restrictAPICall('/tests/', '/src/')

    // Call private method
    await this.populateChannelData(channel, name, info, url, icon, iconV2)

    await this.populateAliasData(channel, aliasAddress, aliasBlockchainId)
  }

  // To populate channel data
  private async populateChannelData(
    channel: string,
    name: string,
    info: string,
    url: string,
    icon: string,
    iconV2: string
  ) {
    const logger = this.logger
    logger.debug(
      'Trying to add name: ' + name + '\ninfo: ' + info + '\nurl: ' + url + '\nicon: ' + icon
    )
    const query =
      'UPDATE channels SET name=?, info=?, url=?, icon=?, iconV2=?, processed=1 WHERE channel=?'

    return await new Promise((resolve, reject) => {
      db.query(
        query,
        [name, info, url, icon, iconV2, channel],
        function (err: any, results: unknown) {
          if (err) {
            return reject(err)
          } else {
            return resolve(results)
          }
        }
      )
    })
      .then((response) => {
        logger.info('Completed populateChannelData(): %o', response)
        return true
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  // 🔥 🔥 IMPORTANT: INTERNAL METHOD / DO NOT USE
  public async _bumpAttemptCount(channel: string) {
    // IMPORTANT: THIS CALL IS RESTRICTED FOR TEST CASES ONLY //
    restrictAPICall('/tests/', '/src/')

    // Call private method
    await this.bumpAttemptCount(channel)
  }

  private async bumpAttemptCount(channel: string) {
    const logger = this.logger
    const query = 'UPDATE channels SET attempts=attempts+1 WHERE channel=?'

    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (err: any, results: unknown) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed bumpAttemptCount()')
        return true
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  public async getChannels(page: number, pageSize: number) {
    const logger = this.logger

    const offset = (page - 1) * pageSize

    const query = `select * from channels ORDER BY verified_status DESC,id LIMIT ${pageSize} OFFSET ${offset}`

    return await new Promise((resolve, reject) => {
      db.query(query, function (err, results) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            logger.info('Completed getChannels() with result', results)
            const array = []
            resolve({ count: results.length, results })
          } else {
            logger.info('Completed getChannels() with no result')
            resolve({ results, count: results.length })
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async setChannelActivationStatus(channel: any, status: number) {
    const logger = this.logger
    const query = 'UPDATE channels SET activation_status=? WHERE channel=?;'
    return await new Promise((resolve, reject) => {
      db.query(query, [status, channel], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed setChannelActivationStatus()')
      })
      .catch((err) => {
        logger.error(err)
      })
  }

  public async setChannelBlockedStatus(channel: string, blockStatus: number) {
    const logger = this.logger
    const query = `UPDATE channels SET blocked=${blockStatus} WHERE channel=?`
    logger.debug(' Blocked channel %s', channel)
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          logger.info('Blocked channel %s', channel)
          resolve({ status: true })
        }
      })
    })
  }

  public async isChannelBlocked(channel: string) {
    const logger = this.logger
    const query = 'SELECT blocked from channels WHERE channel=?;'
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed isChannelBlocked()')
        if (response.length !== 0 && response[0])
          return { success: true, status: response[0] && response[0].blocked == 1 ? true : false }
        else return { success: true, status: false }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  public async setDelegateeAddress(channel: string, delegatee: string) {
    const logger = this.logger
    const aliasClass = Container.get(Alias)
    const channelDetails = await this.getChannel(channel)
    const aliasStatus = await aliasClass.isAliasVerified(channel)

    try {
      if (channelDetails || aliasStatus) {
        const query = 'INSERT INTO delegates (channel, delegate) VALUES (?, ?); '
        return await new Promise((resolve, reject) => {
          db.query(query, [channel, delegatee], function (error, results) {
            if (error) {
              return reject(error)
            } else {
              logger.info(
                'Completed setDelegateeAddress() for channel % with delegate as %',
                channel,
                delegatee
              )
              resolve({ channel, delegatee })
            }
          })
        })
      } else {
        logger.error('Channel doesnt exits')
      }
    } catch (error) {
      logger.error('Error in setDelegateeAddress: %o', error)
    }
  }

  public async removeDelegateeAddress(channel: string, deleagte: string) {
    const logger = this.logger
    const query = 'DELETE FROM delegates WHERE channel=? AND delegate=?'
    return await new Promise((resolve, reject) => {
      db.query(query, [channel, deleagte], function (error: any, results: any) {
        if (error) {
          return reject(error)
        } else {
          logger.info(
            'Completed removeDelegateeAddress() for channel % with delegate as %',
            channel,
            deleagte
          )
          resolve({ channel, deleagte })
        }
      })
    })
  }

  public async getDelegateFromChannel(channel: any) {
    const logger = this.logger

    const query = 'SELECT delegate FROM delegates WHERE channel=?'
    return await new Promise((resolve, reject) => {
      try {
        db.query(query, [channel], function (error, results) {
          if (error) {
            return reject(error)
          } else {
            if (results.length > 0) {
              const delegates = []
              for (const i in results) {
                delegates.push(results[i].delegate)
              }
              logger.info('Completed getDelegateFromChannel()')
              resolve({ delegates: delegates })
            } else {
              logger.info('Completed getDelegateFromChannel() with no result')
              resolve({ delegates: [] })
            }
          }
        })
      } catch (error) {
        logger.error(error)
      }
    })
  }

  private async removeChannelDelegatee(channel: string) {
    const logger = this.logger
    const query = 'DELETE from delegates where channel = ?'
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          logger.info('Completed removeChannelDelegatee() for Channel: %s', channel)
          resolve(true)
        }
      })
    })
  }

  public async getChannelOwnersFromDelegate(user: any) {
    const logger = this.logger
    const query = 'SELECT channel FROM delegates WHERE delegate=?'
    return await new Promise((resolve, reject) => {
      db.query(query, [user], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          if (results.length > 0) {
            logger.info('Completed getDelegateFromChannel()')
            const channels = []
            results.forEach((value: { channel: any }, index: any) => {
              channels.push(value.channel)
            })
            resolve({ channelOwners: channels, length: channels.length })
          } else {
            logger.info('Completed getDelegateFromChannel() with no result')
            resolve(null)
          }
        }
      })
    })
  }

  public async verifyChannel(channel: any) {
    const logger = this.logger
    const query = 'UPDATE channels SET verified_status=1 WHERE channel=?'
    logger.debug('Verification for channel %s', channel)
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          logger.info('Verified channel %s', channel)
          resolve({ status: true })
        }
      })
    })
  }

  // 🔥 🔥 IMPORTANT: INTERNAL METHOD / DO NOT USE
  public async _verifyChannelAlias(channel: any) {
    // IMPORTANT: THIS CALL IS RESTRICTED FOR TEST CASES ONLY //
    restrictAPICall('/tests/', '/src/')

    const logger = this.logger
    const query = 'UPDATE channels SET is_alias_verified=1 WHERE channel=?'
    logger.debug('Verification for channel %s', channel)
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          logger.info('Verified channel %s', channel)
          resolve({ status: true })
        }
      })
    })
  }

  public async unVerifyChannel(channel: any) {
    const logger = this.logger
    logger.debug('Unverification for channel %s', channel)
    const query = 'UPDATE channels SET verified_status=0 WHERE channel=?'
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          logger.info('Unverified channel %s', channel)
          resolve({ status: true })
        }
      })
    })
  }

  public async getAliasDetails(alias: string) {
    const logger = this.logger

    const query = `
      SELECT a.channel, a.alias_address, a.is_alias_verified, c.activation_status, c.blocked
      FROM aliases a
      JOIN channels c ON a.channel = c.channel
      WHERE a.alias_address = ?;
  `

    return await new Promise((resolve, reject) => {
      db.query(query, [alias], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          if (results.length > 0) {
            logger.info('Completed getAliasDetails()')
            resolve(results[0])
          } else {
            logger.info('Completed getAliasDetails() with no result')
            resolve(null)
          }
        }
      })
    })
  }

  public async addSubGraphDetails(channel: string, subgraphIdentity: string) {
    const logger = this.logger
    const query = 'UPDATE channels SET subgraph_details=?, counter=? WHERE channel=?;'
    return await new Promise(async (resolve, reject) => {
      const subgraphDetails = ethers.utils.toUtf8String(subgraphIdentity)
      const interprettedSubgraphDetails = epnsAPIHelper.interpretSubgraphIdentity(subgraphDetails)
      const counter = await getSubgraphCounter(interprettedSubgraphDetails.subgraphId)
      if (interprettedSubgraphDetails.pollTime > config.theGraphPollTime) {
        db.query(query, [subgraphDetails, counter, channel], function (error, results) {
          if (error) {
            return reject({ status: false, error: error })
          } else {
            scheduleTask(
              channel,
              interprettedSubgraphDetails.pollTime,
              counter,
              secondsToHms(interprettedSubgraphDetails.pollTime),
              interprettedSubgraphDetails.subgraphId,
              logger
            )
            resolve({ status: true })
          }
        })
      }
    })
  }

  public async getSubGraphDetails(channel: string) {
    const logger = this.logger
    const query = 'SELECT subgraph_details FROM channels WHERE channel=?;'
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject({ status: false, error: error })
        } else {
          if (results.length > 0) {
            if (results[0].subgraph_details) {
              const interprettedSubgraphDetails = epnsAPIHelper.interpretSubgraphIdentity(
                results[0].subgraph_details
              )
              resolve({
                status: true,
                result: {
                  subGraphId: interprettedSubgraphDetails.subgraphId,
                  pollTime: interprettedSubgraphDetails.pollTime
                }
              })
              logger.info('Completed getSubGraphDetails()')
            } else {
              resolve({ status: true, result: null })
            }
          } else {
            logger.info('Completed getSubGraphDetails() with no result')
            resolve({ status: true, result: null })
          }
        }
      })
    })
  }

  public async getAllSubGraphDetails(): Promise<{ status: boolean; result: any }> {
    const logger = this.logger
    const query = `SELECT channel, subgraph_details, counter, subgraph_attempts FROM channels WHERE subgraph_details IS NOT NULL AND subgraph_details NOT LIKE "NULL"`
    return await new Promise((resolve, reject) => {
      db.query(query, function (error, results) {
        if (error) {
          return reject({ status: false, error: error })
        } else {
          if (results.length > 0) {
            logger.info('Completed getAllSubGraphDetails()')
            resolve({ status: true, result: results })
          } else {
            logger.info('Completed getAllSubGraphDetails() with no result')
            resolve({ status: true, result: null })
          }
        }
      })
    })
  }

  public async updateSubgraphDetails(
    channel: string,
    field: string,
    data: any
  ): Promise<{ status: boolean; error: any }> {
    const logger = this.logger
    if (!VALID_SUBGRAPH_FIELDS.includes(field)) return { status: false, error: 'Not Valid Input' }
    let query
    let value
    if (field == 'subgraph_attempts') {
      query = 'UPDATE channels SET subgraph_attempts=subgraph_attempts+1 WHERE channel=?;'
      value = [channel]
    } else {
      query = `UPDATE channels SET ${field}=? WHERE channel =?`
      value = [data, channel]
    }
    return await new Promise((resolve, reject) => {
      db.query(query, value, function (error, results) {
        if (error) {
          return reject({ status: false, error: error })
        } else {
          logger.info('Completed updateSubgraphCounter()')
          return resolve({ status: true, error: null })
        }
      })
    })
  }

  public async getSubgraphRetires(
    channel: string
  ): Promise<{ status: boolean; error: any; result: any }> {
    const logger = this.logger
    const query = `SELECT  subgraph_attempts from channels WHERE channel=?;`
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject({ status: false, error: error, result: null })
        } else if (results.length == 0) {
          return resolve({ status: true, error: null, result: null })
        } else {
          return resolve({ status: true, error: null, result: results[0].subgraph_attempts })
        }
      })
    })
  }

  public async destoryTimeBoundChannel(channel: string) {
    const logger = this.logger
    logger.debug('Trying to destroy time bound channel: %s', channel)
    const channelDetails = await this.getChannel(channel)
    if (channelDetails) {
      await this.deleteChannel(channel) // remove channel
      await this.removeChannelDelegatee(channel) // remove channel's delegate
      if (channelDetails.is_alias_verified === 1 && channelDetails.alias_details)
        await this.removeChannelDelegatee(channelDetails.alias_details) // remove alias's delegate
      const subscribersObject = new Subscribers(logger)
      await subscribersObject.batchUnsubscribe(channel) // unsubscribe from channel
      logger.info('Completed destoryTimeBoundChannel()')
    }
    logger.info('Completed destoryTimeBoundChannel() with no result')
  }

  public async addChannelSettings(
    channel: string,
    channelSettings: string,
    notificationDescription: string
  ) {
    const logger = this.logger
    logger.debug('Trying to add channel settings: %s', channel)
    const expandedChannelSetting = JSON.stringify(
      parseChannelSetting(channelSettings, notificationDescription)
    )
    const query = `UPDATE channels set channel_settings=?, minimal_channel_settings=? where channel=?`
    return await new Promise((resolve, reject) => {
      db.query(
        query,
        [expandedChannelSetting, channelSettings, channel],
        function (error, results) {
          if (error) {
            return reject({ status: false, error: error })
          } else {
            logger.info('Completed addChannelSettings()')
            return resolve({ status: true, error: null })
          }
        }
      )
    })
  }

  public async getChannelSettings(
    channel: string
  ): Promise<{ status: boolean; error: any; result: null | string }> {
    const logger = this.logger
    logger.debug('Trying to get channel settings: %s', channel)
    let query = null
    if (caipHelper.convertCaipToObject(channel).result.chainId == config.ethereumChainId) {
      query = `SELECT channel_settings from channels where channel=?`
    } else {
      query = `SELECT channels.channel_settings from channels JOIN aliases ON channels.channel = aliases.channel where aliases.alias_address=?`
    }
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject({ status: false, error: error, result: null })
        } else if (results.length == 0) {
          return resolve({ status: true, error: null, result: null })
        } else {
          return resolve({ status: true, error: null, result: results[0].channel_settings })
        }
      })
    })
  }

  public async getChannelIcon(channel: string) {
    const logger = this.logger
    const self = this
    logger.debug('Trying to get channel icon: %s', channel)
    const query = `SELECT iconV2 from channels where channel=?`

    const channelInCAIP = caipHelper.convertAddressToCaip(channel, config.ethereumChainId).result
    try {
      const channelIcon = await self.getChannelIconFromCache(channel)
      if (channelIcon) return channelIcon
    } catch (e) {
      logger.error('Error in getting channel icon from cache: %o', e)
    }

    return await new Promise((resolve, reject) => {
      db.query(query, [channelInCAIP], async function (error, results) {
        if (error) {
          return reject({ status: false, error: error, result: null })
        } else if (results.length == 0) {
          return resolve('')
        } else {
          try {
            await self.saveChannelIconToCache(channel, results[0].iconV2)
          } catch (e) {
            logger.error('Error in saving channel icon to cache: %o', e)
          }
          return resolve(results[0].iconV2)
        }
      })
    })
  }

  public async saveChannelIconToCache(channel: string, icon: string) {
    return await redisClient.set(CHANNEL_ICON_PREFIX + channel, icon)
  }
  public async getChannelIconFromCache(channel: string) {
    return await redisClient.get(CHANNEL_ICON_PREFIX + channel)
  }
}

export type ChannelRecord = {
  id: number
  channel: string
  ipfshash: string
  name: string
  info: string
  url: string
  icon: string
  processed: number
  attempts: number
  alias_address: string
  alias_blockchain_id: string
  is_alias_verified: number
  blocked: number
  alias_verification_event: null
  activation_status: number
  verified_status: number
  subgraph_details: null
  subgraph_attempts: number
  counter: null
  timestamp: Date
  channel_settings: null
  subscriber_count: number
}
