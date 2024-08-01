import { Container, Inject, Service } from 'typedi'

import { convertCaipToObject, isValidCAIP10Address } from '../../helpers/caipHelper'
import ChannelsService from '../channelsService'

const db = require('../../helpers/dbHelper')

@Service('alias')
export default class Alias {
  constructor(@Inject('logger') private logger) {}

  // To get an alias for a channel
  private async getAlias(channel: String, aliasAddress: string) {
    const logger = this.logger

    logger.debug(
      `Trying to get alias info for channel: ${channel} and aliasAddress: ${aliasAddress}`
    )
    const query = `SELECT * FROM aliases WHERE channel=? AND alias_address=? LIMIT 1`

    return await new Promise((resolve, reject) => {
      db.query(query, [channel, aliasAddress], function (err: any, results: string | any[]) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            logger.info('Completed getAlias()')
            resolve(results[0])
          } else {
            logger.info('Completed getAlias() with no result')
            resolve(null)
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      return Promise.reject(err)
    })
  }

  // To get all aliases for a channel
  public async getAliasesForChannel(channel: String): Promise<any[]> {
    const logger = this.logger

    logger.debug(`Trying to get all aliases for channel: ${channel}`)
    const query = `SELECT * FROM aliases WHERE channel=?`

    try {
      return await new Promise<any[]>((resolve, reject) => {
        db.query(query, [channel], function (err: any, results: any[]) {
          if (err) {
            logger.error(err)
            reject(err)
          } else {
            logger.info('Completed getAliasesForChannel()')
            resolve(results)
          }
        })
      })
    } catch (err) {
      logger.error(err)
      throw err
    }
  }

  public async getChannelFromAlias(aliasAddress: string) {
    const logger = this.logger

    logger.debug(`Trying to get alias with aliasAddress: ${aliasAddress}`)
    const query = `SELECT * FROM aliases WHERE alias_address=? OR channel=? LIMIT 1`

    return await new Promise((resolve, reject) => {
      db.query(query, [aliasAddress], function (err: any, results: string | any[]) {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          if (results.length > 0) {
            logger.info('Completed getChannelFromAlias()')
            resolve(results[0])
          } else {
            logger.info('Completed getChannelFromAlias() with no result')
            resolve(null)
          }
        }
      })
    }).catch((err) => {
      logger.error(err)
      return Promise.reject(err)
    })
  }

  public async updateChannelAliasAddress(
    channel: string,
    aliasAddress: string,
    verificationProof: string
  ) {
    const logger = this.logger
    const alias = await this.getAlias(channel, aliasAddress)

    if (alias && alias.is_alias_verified == 0) {
      const query =
        'UPDATE aliases SET initiate_verification_proof=? WHERE channel=? AND alias_address=?;'

      return await new Promise((resolve, reject) => {
        db.query(
          query,
          [verificationProof, channel, aliasAddress],
          function (err: any, results: unknown) {
            if (err) {
              logger.error(err)
              return reject(err)
            } else {
              return resolve(results)
            }
          }
        )
      })
        .then(() => {
          logger.info('Completed updating channel alias;')
        })
        .catch((err) => {
          logger.error(err)
        })
    } else {
      try {
        const aliases = await this.getAliasesForChannel(channel)

        for (const alias of aliases) {
          const aliasChainId = convertCaipToObject(alias.alias_address).result.chainId
          const aliasAddressChainId = convertCaipToObject(aliasAddress).result.chainId
          if (aliasChainId === aliasAddressChainId) {
            logger.info(`Channel already contains alias from this chain. Skipping...`)
            return
          }
        }

        const query =
          'INSERT INTO aliases SET alias_address=?, processed=1, channel=?, initiate_verification_proof=?;'

        return await new Promise((resolve, reject) => {
          db.query(
            query,
            [aliasAddress, channel, verificationProof],
            function (err: any, results: unknown) {
              if (err) {
                logger.error(err)
                return reject(err)
              } else {
                return resolve(results)
              }
            }
          )
        })
          .then(() => {
            logger.info('Completed adding channel alias;')
          })
          .catch((err) => {
            logger.error(err)
          })
      } catch (error) {
        console.error(`Error retrieving aliases: ${error}`)
      }
    }
  }

  public async isAliasVerified(aliasAddress: string) {
    const logger = this.logger
    const query = 'SELECT is_alias_verified from aliases WHERE alias_address=?;'

    return await new Promise((resolve, reject) => {
      db.query(query, [aliasAddress], function (err, results) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then((response) => {
        logger.info('Completed isAliasVerified()')
        if (response.length !== 0 && response[0])
          return {
            success: true,
            status: response[0] && response[0].is_alias_verified == 1 ? true : false
          }
        else return { success: true, status: false }
      })
      .catch((err) => {
        logger.error(err)
        throw err
      })
  }

  public async getAliasFromEthChannel(ethAddress: string) {
    const logger = this.logger
    const query = 'SELECT alias_address from aliases WHERE channel=? ;'
    return await new Promise((resolve, reject) => {
      db.query(query, [ethAddress], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          if (results.length > 0) {
            logger.info('Completed getAliasFromEthChannel()')
            resolve({ aliasAddress: results[0].alias_address })
          } else {
            logger.info('Completed getAliasFromEthChannel() with no result')
            resolve({ aliasAddress: null })
          }
        }
      })
    })
  }

  // Check if an alias is alread is in use and based on that set the is_alias_verified
  public async checkAndUpdateAlias(
    channel: any,
    aliasAddress: any,
    aliasBlockchainId: any,
    verificationProof: any
  ) {
    const logger = this.logger
    const aliasEvent = {
      aliasAddress: aliasAddress,
      aliasBlockchainId: aliasBlockchainId
    }
    const query =
      'UPDATE aliases SET alias_verification_event=?, verify_verification_proof=? WHERE channel=? AND alias_address=? AND is_alias_verified=0;'
    return await new Promise((resolve, reject) => {
      db.query(
        query,
        [JSON.stringify(aliasEvent), verificationProof, channel, aliasAddress],
        function (err: any, results: unknown) {
          if (err) {
            logger.error(err)
            return reject(err)
          } else {
            return resolve(results)
          }
        }
      )
    })
      .then(() => {
        logger.info('Completed checkAndUpdateAlias()')
        const channels = Container.get(ChannelsService)
        channels.batchProcessAliasVerificationData()
      })
      .catch((err) => {
        logger.error(err)
      })
  }

  public async removeChannelAlias(ownerAddress: string, baseChannelAddress: string) {
    const logger = this.logger

    if (isValidCAIP10Address(baseChannelAddress)) {
      const selectChannelOwnerQuery = 'SELECT * FROM aliases WHERE channel=? AND alias_address=?;'
      const deleteQuery = 'DELETE FROM aliases WHERE channel=? AND alias_address=?;'

      const selectAliasOwnerQuery1 = 'SELECT * FROM aliases WHERE channel=? AND alias_address=?;'

      return await new Promise((resolve, reject) => {
        db.query(
          selectChannelOwnerQuery,
          [ownerAddress, baseChannelAddress],
          function (err: any, result: unknown) {
            if (err) {
              logger.error(err)
              return reject(err)
            } else {
              if (result.length > 0) {
                db.query(
                  deleteQuery,
                  [ownerAddress, baseChannelAddress],
                  function (err: any, result: unknown) {
                    if (err) {
                      logger.error(err)
                      return reject(err)
                    } else {
                      return resolve(true)
                    }
                  }
                )
              } else {
                db.query(
                  selectAliasOwnerQuery1,
                  [baseChannelAddress, ownerAddress],
                  function (err: any, result: unknown) {
                    if (err) {
                      logger.error(err)
                      return reject(err)
                    } else {
                      if (result.length > 0) {
                        db.query(
                          deleteQuery,
                          [baseChannelAddress, ownerAddress],
                          function (err: any, result: unknown) {
                            if (err) {
                              logger.error(err)
                              return reject(err)
                            } else {
                              return resolve(true)
                            }
                          }
                        )
                      } else {
                        return reject(
                          new Error('Alias does not exists for channel: ' + baseChannelAddress)
                        )
                      }
                    }
                  }
                )
              }
            }
          }
        )
      })
        .then(() => {
          logger.info('Completed removeChannelAlias()')
        })
        .catch((err) => {
          logger.error(err)
        })
    } else {
      logger.info(`Channel does not exists or alias address is not in valid format .`)
    }
  }

  //to update alias in subscribers table after alias is verified
  public async updateVerifiedAliasInSub(channel: string, alias: any) {
    const logger = this.logger
    logger.debug('Trying to update alias for channel: ' + channel)
    const query = 'UPDATE subscribers SET alias=? WHERE channel=?;'
    return await new Promise((resolve, reject) => {
      db.query(query, [alias, channel], function (err: any, results: unknown) {
        if (err) {
          return reject(err)
        } else {
          return resolve(results)
        }
      })
    })
      .then(() => {
        logger.info('Completed updateVerifiedAliasInSub()')
      })
      .catch((err) => {
        logger.error(err)
      })
  }
}
