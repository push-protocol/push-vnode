import { reject } from 'lodash'
import { Container, Inject, Service } from 'typedi'

import config from '../config'
import { EventDispatcher, EventDispatcherInterface } from '../decorators/eventDispatcher'
import { BlockRangeHelper } from '../helpers/blockRangeHelper'
import { getChannelAddressfromEthAddress } from '../helpers/caipHelper'
import * as channelAndAliasHelper from '../helpers/channelAndAliasHelper'
import { getProtocolMetaValues, updateProtocolMetaValues } from '../helpers/protocolMetaHelper'
import Alias from './channelsCompositeClasses/aliasClass'
import Channel from './channelsCompositeClasses/channelsClass'
import ChannelsService from './channelsService'
import PayloadsService from './payloadsService'
import epnsAPIHelper, { InterContract, SubscribersResult } from '../helpers/epnsAPIHelper'
const utils = require('../helpers/utilsHelper')
import { EventType } from '../enums/EventType'
import { NumUtil } from '../utilz/numUtil'
import { Logger } from 'winston'
import { WinstonUtil } from '../utilz/winstonUtil'
//contract type
const CONTRACT_TYPE: string[] = ['Core', 'Comm']
//blockchain type
// TODO: shift from array index to something definite like key of an object. Rational: What if we use index 6 but it doesnt exists.
const CORE_BLOCKCHAIN_TYPE = config.supportedSourceTypes[0]
// remove the last type defined in supportedSourceTypes as they are not part of onchain activity
const BLOCKCHAIN_TYPE: string[] = config.supportedSourceTypes.filter((item) => {
  return item != config.graphId && item != config.videoId
})

//Keep adding the new verificatoion for new blockchains
const VERIFICATION_TYPE: string[] = config.supportedCAIP
const VERIFICATION_PROOF_DELIMITER = ':'
const BLOCK_RANGE_CHUNK_SIZE = 10000

@Service()
export default class HistoryFetcherService {
  public log: Logger = WinstonUtil.newLog(HistoryFetcherService)
  constructor(
    @Inject('logger') private logger,
    @Inject('dynamicLogger') private dynamicLogger,
    @EventDispatcher() private eventDispatcher: EventDispatcherInterface
  ) {}

  //to get interactable contract
  //to get interactable contract
  public async getInteractableContract(
    blockchain: string,
    type: string,
    offset: number = 0
  ): Promise<InterContract> {
    const logger = this.logger
    logger.info(`Getting interactabale contract for ${blockchain}`)

    let network = config.web3EthereumNetwork
    let contractAddress = config.deployedCoreContract
    let contractABI = config.deployedCoreContractABI

    // CORE Contract always is on Ethereum
    if (type == CONTRACT_TYPE[0]) {
      // do nothing, the variables already default to this scenario
    } else if (type == CONTRACT_TYPE[1]) {
      contractAddress = config.deployedCommunicatorContractEthereum
      contractABI = config.deployedCommunicatorContractABI

      switch (blockchain) {
        case BLOCKCHAIN_TYPE[0]:
          break
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[80002]:
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[137]:
          contractAddress = config.deployedCommunicatorContractPolygon
          network = config.web3PolygonNetwork
          break
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[97]:
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[56]:
          contractAddress = config.deployedCommunicatorContractBsc
          network = config.web3BscNetwork
          break
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[42161]:
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[421614]:
          contractAddress = config.deployedCommunicatorContractArbitrum
          network = config.web3ArbitrumNetwork
          break
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[10]:
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[11155420]:
          contractAddress = config.deployedCommunicatorContractOptimism
          network = config.web3OptimismNetwork
          break
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[1101]:
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[2442]:
          contractAddress = config.deployedCommunicatorContractPolygonZkEVM
          network = config.web3PolygonZkEVMNetwork
          break
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[123]:
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[122]:
          contractAddress = config.deployedCommunicatorContractFuse
          network = config.web3FuseNetwork
          break
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[80085]:
          contractAddress = config.deployedCommunicatorContractBerachain
          network = config.web3BerachainNetwork
          break
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[59141]:
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[59144]:
          contractAddress = config.deployedCommunicatorContractLinea
          network = config.web3LineaNetwork
          break
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[111557560]:
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[7560]:
          contractAddress = config.deployedCommunicatorContractCyberConnect
          network = config.web3CyberConnectNetwork
          break
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[84532]:
        case config.MAP_ID_TO_BLOCKCHAIN_STRING[8453]:
          contractAddress = config.deployedCommunicatorContractBase
          network = config.web3BaseNetwork
          break
      }
    }

    const contract = await epnsAPIHelper.getInteractableContracts(
      network, // Network for which the interactable contract is req
      {
        // API Keys
        etherscanAPI: config.etherscanAPI,
        infuraAPI: config.infuraAPI,
        alchemyAPI: config.alchemyAPI
      },
      null, // Private Key of the Wallet
      contractAddress, // The contract address which is going to be used
      contractABI // The contract abi which is going to be useds
    )

    logger.info(
      `Fetched getInteractableContract() [${utils.getCallerFile()}], chain: ${blockchain}, contract: ${type}`
    )

    return contract
  }

  // -- SYNCING CORE PROTOCOL
  // 1. To sync PUSH Protocol Channels Creation / Updation
  // To get EPNS Channels History
  public async getChannelsHistory(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all channels from block: %d to block: %d', fromBlock, toBlock)
      const channelsList = await epnsAPIHelper
        .getChannelsList(epnsCore.contract, fromBlock, toBlock, blockchain)
        .catch((err) => reject(err))

      logger.info(
        'Completed getChannelsHistory() | Number of Channels: %d',
        Object.keys(channelsList).length
      )
      resolve(channelsList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncChannelsData(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Channels...')

      let channelAdded = 0
      let channelUpdated = 0

      const totalChannels = await this.getChannelsHistory(fromBlock, toBlock, blockchain, epnsCore)
        .then(async (channelsList) => {
          logger.info('Got Channels List (Added and Updated): | %o | Updating...', channelsList)

          const channels = Container.get(Channel)
          let count = 0

          Object.keys(channelsList).forEach(
            await async function (key) {
              logger.debug('Created Channel Object: %o', channelsList[key])
              logger.debug('Created Channel: %s', channelsList[key].channel.toString())

              await channels
                .getChannel(`${caipId}:${channelsList[key].channel}`)
                .then(async (response) => {
                  if (!response) {
                    // Channel is New, Add
                    await channels
                      .addChannel(
                        `${caipId}:${channelsList[key].channel}`,
                        channelsList[key].channelType,
                        channelsList[key].identity
                      )
                      .then((response) => {
                        channelAdded = channelAdded + 1
                        logger.info(
                          'Added Channel: %s | %d | %s',
                          `${caipId}:${channelsList[key].channel}`,
                          channelsList[key].channelType,
                          channelsList[key].identity
                        )
                      })
                      .catch((err) => {
                        logger.warn(
                          'Skipped Adding Channel: %s | Error: %o',
                          `${caipId}:${channelsList[key].channel}`,
                          err
                        )
                      })
                  } else {
                    // Channel Exists, Update
                    await channels
                      .updateChannel(
                        `${caipId}:${channelsList[key].channel}`,
                        channelsList[key].identity
                      )
                      .then(async (response) => {
                        channelUpdated = channelUpdated + 1
                        logger.info(
                          'Updated Channel: %s | %s',
                          channelsList[key].channel,
                          channelsList[key].identity
                        )
                      })
                      .catch((err) => {
                        logger.warn(
                          'Skipped Updating Channel: %s | Error: %o',
                          channelsList[key].channel,
                          err
                        )
                      })
                  }
                })
                .catch((err) => {
                  logger.warn(
                    'Unable to retrieve Channel Metadata: %s | Error: %o',
                    channelsList[key].channel,
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(1, {
                    chalkIt: `green.dim`,
                    title: '\tAdd Channel Events',
                    progress: count,
                    total: Object.keys(channelsList).length,
                    append: 'AddChannel(channel, channelType, identity)'
                  })
                })
            }
          )

          return Object.keys(channelsList).length
        })
        .catch((err) => {
          logger.error(err)
        })

      dynamicLogger.updateLogs(1, {
        chalkIt: `green.dim`,
        title: '\tAdd Channels Events',
        progress: 1,
        total: 1,
        append: 'AddChannel(channel, channelType, identity)'
      })

      resolve({
        totalChannels: totalChannels,
        channelAdded: channelAdded,
        channelUpdated: channelUpdated
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 2. To sync Channels Block History
  public async getChannelsBlockHistory(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all channels from block: %d to block: %d', fromBlock, toBlock)
      const blockedChannelList = await epnsAPIHelper
        .getContractEventsList(epnsCore.contract, EventType.ChannelBlocked, fromBlock, toBlock)
        .catch((err) => reject(err))

      logger.info(
        'Completed getChannelsBlockHistory() | Number of Channels: %d',
        Object.keys(blockedChannelList).length
      )
      resolve(blockedChannelList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncChannelBlockData(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Core ChannelBlocking...')

      await this.getChannelsBlockHistory(fromBlock, toBlock, blockchain, epnsCore)
        .then(async (totalBlokcedChannelList) => {
          logger.info(
            'Got Blocked List (ChannelBlocked): | %o | Updating...',
            totalBlokcedChannelList
          )

          const channels = Container.get(Channel)
          let count = 0

          Object.keys(totalBlokcedChannelList).forEach(
            await async function (key) {
              logger.debug('Blocked Channel Object: %o', totalBlokcedChannelList[key])
              logger.debug('Blocked Channel: %s', totalBlokcedChannelList[key].channel.toString())

              await channels
                .setChannelBlockedStatus(
                  `${caipId}:${totalBlokcedChannelList[key].channel.toString()}`,
                  1
                )
                .then((response) => {
                  logger.info(
                    'Updated Channel Status to Blocked: %s',
                    totalBlokcedChannelList[key].channel.toString()
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped Updating Channel Blocking: %s | Error: %o',
                    totalBlokcedChannelList[key].channel.toString(),
                    err
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Unable to Set Blocked Status: %s | Error: %o',
                    totalBlokcedChannelList[key].channel.toString(),
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(2, {
                    chalkIt: `green.dim`,
                    title: '\tChannel Blocked Events',
                    progress: count,
                    total: Object.keys(totalBlokcedChannelList).length,
                    append: 'ChannelBlocked(_channelAddress)'
                  })
                })
            }
          )

          return Object.keys(totalBlokcedChannelList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(2, {
        chalkIt: `green.dim`,
        title: '\tChannel Blocked Events',
        progress: 1,
        total: 1,
        append: 'ChannelBlocked(_channelAddress)'
      })

      resolve({
        success: true
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 3. Sync Channel Deactivation
  public async getChannelsDeactivationHistory(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all channels from block: %d to block: %d', fromBlock, toBlock)
      const deactivatedChannelList = await epnsAPIHelper
        .getContractEventsList(epnsCore.contract, EventType.DeactivateChannel, fromBlock, toBlock)
        .catch((err) => reject(err))

      logger.info(
        'Completed getChannelsDeactivationHistory() | Number of Channels: %d',
        Object.keys(deactivatedChannelList).length
      )
      resolve(deactivatedChannelList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncChannelDeactivationData(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Core ChannelDeactivation...')

      await this.getChannelsDeactivationHistory(fromBlock, toBlock, blockchain, epnsCore)
        .then(async (totalDeactivatedChannelList) => {
          logger.info(
            'Got Deactivation List (SendMessage): | %o | Updating...',
            totalDeactivatedChannelList
          )

          const channels = Container.get(Channel)
          let count = 0

          Object.keys(totalDeactivatedChannelList).forEach(
            await async function (key) {
              logger.debug('Deactivated Channel Object: %o', totalDeactivatedChannelList[key])
              logger.debug(
                'Deactivated Channel: %s',
                totalDeactivatedChannelList[key].channel.toString()
              )
              await channels
                .setChannelActivationStatus(
                  `${caipId}:${totalDeactivatedChannelList[key].channel.toString()}`,
                  0
                )
                .then((response) => {
                  logger.info(
                    'Updated Channel Status to Deactivated: %s',
                    totalDeactivatedChannelList[key].channel.toString()
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped Updating Channel Deactivation: %s | Error: %o',
                    totalDeactivatedChannelList[key].channel.toString(),
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(3, {
                    chalkIt: `green.dim`,
                    title: '\tChannel Deactivated Events',
                    progress: count,
                    total: Object.keys(totalDeactivatedChannelList).length,
                    append: 'DeactivateChannel(channel, totalRefundableAmount)'
                  })
                })
            }
          )

          return Object.keys(totalDeactivatedChannelList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(3, {
        chalkIt: `green.dim`,
        title: '\tChannel Deactivated Events',
        progress: 1,
        total: 1,
        append: 'DeactivateChannel(channel, totalRefundableAmount)'
      })

      resolve({
        success: true
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 4. Sync Channel Reactivation
  public async getChannelsReactivationHistory(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all channels from block: %d to block: %d', fromBlock, toBlock)
      const reactivatedChannelList = await epnsAPIHelper
        .getContractEventsList(epnsCore.contract, EventType.ReactivateChannel, fromBlock, toBlock)
        .catch((err) => reject(err))

      logger.info(
        'Completed getChannelsReactivationHistory() | Number of Channels: %d',
        Object.keys(reactivatedChannelList).length
      )
      resolve(reactivatedChannelList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncChannelReactivationData(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Core ChannelReactivation...')

      this.getChannelsReactivationHistory(fromBlock, toBlock, blockchain, epnsCore)
        .then(async (totalReactivatedChannelList) => {
          logger.info(
            'Got Reactivation List (ReactivateChannel): | %o | Updating...',
            totalReactivatedChannelList
          )

          const channels = Container.get(Channel)
          let count = 0

          Object.keys(totalReactivatedChannelList).forEach(
            await async function (key) {
              logger.debug('Reactivated Channel Object: %o', totalReactivatedChannelList[key])
              logger.debug(
                'Reactivated Channel: %s',
                totalReactivatedChannelList[key].channel.toString()
              )

              await channels
                .setChannelActivationStatus(
                  `${caipId}:${totalReactivatedChannelList[key].channel.toString()}`,
                  1
                )
                .then((response) => {
                  logger.info(
                    'Updated Channel Status to Reactivated: %s',
                    totalReactivatedChannelList[key].channel.toString()
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped Updating Channel Reactivation: %s | Error: %o',
                    totalReactivatedChannelList[key].channel.toString(),
                    err
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Unable to Set Reactivation Status: %s | Error: %o',
                    totalReactivatedChannelList[key].channel.toString(),
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(4, {
                    chalkIt: `green.dim`,
                    title: '\tReactivate Channel Events',
                    progress: count,
                    total: Object.keys(totalReactivatedChannelList).length,
                    append: 'ReactivateChannel(channel, amountDeposited)'
                  })
                })
            }
          )

          return Object.keys(totalReactivatedChannelList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(4, {
        chalkIt: `green.dim`,
        title: '\tReactivate Channel Events',
        progress: 1,
        total: 1,
        append: 'ReactivateChannel(channel, channelType, identity)'
      })

      resolve({
        success: true
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 5. Sync Channel Verification Data
  public async getChannelVerifiedHistory(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all verified events from block: %d to block: %d', fromBlock, toBlock)
      const channelVerifiedList = await epnsAPIHelper
        .getContractEventsList(epnsCore.contract, EventType.ChannelVerified, fromBlock, toBlock)
        .catch((err) => reject(err))
      logger.debug('Verified Channels List: %o', channelVerifiedList)

      logger.info(
        'Completed getChannelVerifiedHistory() | Number of channel verified: %d',
        Object.keys(channelVerifiedList).length
      )
      resolve(channelVerifiedList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncChannelVerifiedData(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Core Channel Verified...')

      const totalChannelVerified = await this.getChannelVerifiedHistory(
        fromBlock,
        toBlock,
        blockchain,
        epnsCore
      )
        .then(async (verifiedList) => {
          logger.debug('Got Channel Verified List: | %o | Updating...', verifiedList)

          const channels = Container.get(Channel)
          let count = 0

          Object.keys(verifiedList).forEach(
            await async function (key) {
              await channels
                .verifyChannel(`${caipId}:${verifiedList[key].channel}`)
                .then((response) => {
                  logger.info('Updated Verified Channel: %s | %s ', verifiedList[key].channel)
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped verifying channel: %s | Error: %o',
                    verifiedList[key].channel,
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(5, {
                    chalkIt: `green.dim`,
                    title: '\tChannel Verified Events',
                    progress: count,
                    total: Object.keys(verifiedList).length,
                    append: 'ChannelVerified(channel, verifier)'
                  })
                })
            }
          )

          return Object.keys(verifiedList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(5, {
        chalkIt: `green.dim`,
        title: '\tChannel Verified Events',
        progress: 1,
        total: 1,
        append: 'ChannelVerified(channel, verifier)'
      })

      resolve({
        totalChannelVerified
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 6. Sync Channel unverified data
  public async getChannelUnverifiedHistory(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all messages from block: %d to block: %d', fromBlock, toBlock)
      const channelUnverifiedList = await epnsAPIHelper
        .getContractEventsList(
          epnsCore.contract,
          EventType.ChannelVerificationRevoked,
          fromBlock,
          toBlock
        )
        .catch((err) => reject(err))
      logger.debug('Unverified Channels List: %o', channelUnverifiedList)

      logger.info(
        'Completed getChannelUnverifiedHistory() | Number of channel verified: %d',
        Object.keys(channelUnverifiedList).length
      )
      resolve(channelUnverifiedList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncChannelUnverifiedData(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Core Channel Unverified...')

      const totalChannelUnverified = await this.getChannelUnverifiedHistory(
        fromBlock,
        toBlock,
        blockchain,
        epnsCore
      )
        .then(async (unverifiedList) => {
          logger.info('Got Channel Verified List: | %o | Updating...', unverifiedList)

          const channels = Container.get(Channel)
          let count = 0

          Object.keys(unverifiedList).forEach(
            await async function (key) {
              logger.debug('Channel Unverified List Key: %o', unverifiedList[key])

              await channels
                .unVerifyChannel(`${caipId}:${unverifiedList[key].channel}`)
                .then((response) => {
                  logger.info('Updated Verified Channel: %s | %s ', unverifiedList[key].channel)
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped verifying channel: %s | Error: %o',
                    unverifiedList[key].channel,
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(6, {
                    chalkIt: `green.dim`,
                    title: '\tChannel Unverified Events',
                    progress: count,
                    total: Object.keys(unverifiedList).length,
                    append: 'ChannelUnverified(channel, verifier)'
                  })
                })
            }
          )

          return Object.keys(unverifiedList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(6, {
        chalkIt: `green.dim`,
        title: '\tChannel Unverified Events',
        progress: 1,
        total: 1,
        append: 'ChannelUnverified(channel, verifier)'
      })

      resolve({
        totalChannelUnverified
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 7. Sync Channel Subgraph Data
  public async getAddSubgraphHistory(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all channels from block: %d to block: %d', fromBlock, toBlock)
      const channelWithSubgraphList = await epnsAPIHelper
        .getContractEventsList(epnsCore.contract, EventType.AddSubGraph, fromBlock, toBlock)
        .catch((err) => reject(err))

      logger.info(
        'Completed getAddSubgraphHistory() | Number of Channels: %d',
        Object.keys(channelWithSubgraphList).length
      )
      resolve(channelWithSubgraphList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncAddSubgraphData(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Core AddSubgraph...')

      await this.getAddSubgraphHistory(fromBlock, toBlock, blockchain, epnsCore)
        .then(async (totalChannelWithSubgraphList) => {
          logger.info(
            'Got Subgraph List (SendMessage): | %o | Updating...',
            totalChannelWithSubgraphList
          )

          const channels = Container.get(Channel)
          let count = 0

          Object.keys(totalChannelWithSubgraphList).forEach(
            await async function (key) {
              logger.debug(totalChannelWithSubgraphList[key].channel.toString())
              logger.debug(totalChannelWithSubgraphList[key])

              await channels
                .addSubGraphDetails(
                  `${caipId}:${totalChannelWithSubgraphList[key].channel.toString()}`,
                  totalChannelWithSubgraphList[key]._subGraphData.toString()
                )
                .then((response) => {
                  logger.info(
                    'Updated Channel Subgraph : %s',
                    totalChannelWithSubgraphList[key].channel.toString()
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped Updating Channel Subgraph: %s | Error: %o',
                    totalChannelWithSubgraphList[key].channel.toString(),
                    err
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Unable to Set Subgraph Status: %s | Error: %o',
                    totalChannelWithSubgraphList[key].channel.toString(),
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(9, {
                    chalkIt: `green.dim`,
                    title: '\ttChannel Subgraph Events',
                    progress: count,
                    total: Object.keys(totalChannelWithSubgraphList).length,
                    append: '💎 AddSubGraph(channel, subGraphId, pollTime)'
                  })
                })
            }
          )

          return Object.keys(totalChannelWithSubgraphList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(9, {
        chalkIt: `green.dim`,
        title: '\tChannel Subgraph Events',
        progress: 1,
        total: 1,
        append: 'AddSubGraph(channel, subGraphId, pollTime)'
      })

      resolve({
        success: true
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 8. Sync Time Bound Channel Destruction
  public async getTimeBoundChannelDestroyedHistory(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all channels from block: %d to block: %d', fromBlock, toBlock)
      const timeBoundChannelDestroyedList = await epnsAPIHelper
        .getContractEventsList(
          epnsCore.contract,
          EventType.TimeBoundChannelDestroyed,
          fromBlock,
          toBlock
        )
        .catch((err) => reject(err))

      logger.info(
        'Completed getTimeBoundChannelDestroyedHistory() | Number of Channels: %d',
        Object.keys(timeBoundChannelDestroyedList).length
      )
      resolve(timeBoundChannelDestroyedList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncTimeBoundChannelDestroyedData(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Core TimeBoundChannelDestroyed...')

      await this.getTimeBoundChannelDestroyedHistory(fromBlock, toBlock, blockchain, epnsCore)
        .then(async (totalTimeBoundChannelDestroyedList) => {
          logger.info(
            'Got Time Bound Channel Destroy List (SendMessage): | %o | Updating...',
            totalTimeBoundChannelDestroyedList
          )

          const channels = Container.get(Channel)
          let count = 0

          Object.keys(totalTimeBoundChannelDestroyedList).forEach(
            await async function (key) {
              logger.debug(
                'Time Bound Channel Destroyed Object: %o',
                totalTimeBoundChannelDestroyedList[key]
              )
              logger.debug(
                'Time Bound Channel Destroyed: %s',
                totalTimeBoundChannelDestroyedList[key].channel.toString()
              )
              await channels
                .destoryTimeBoundChannel(
                  `${caipId}:${totalTimeBoundChannelDestroyedList[key].channel.toString()}`
                )
                .then((response) => {
                  logger.info(
                    'Time Bound Channel Destroyed: %s',
                    totalTimeBoundChannelDestroyedList[key].channel.toString()
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped Updating Time Bound Channel Destruction: %s | Error: %o',
                    totalTimeBoundChannelDestroyedList[key].channel.toString(),
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(8, {
                    chalkIt: `green.dim`,
                    title: '\tTime Bound Channel Destroy Events',
                    progress: count,
                    total: Object.keys(totalTimeBoundChannelDestroyedList).length,
                    append: 'TimeBoundChannelDestroyed(channel, amountRefunded)'
                  })
                })
            }
          )

          return Object.keys(totalTimeBoundChannelDestroyedList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(8, {
        chalkIt: `green.dim`,
        title: '\tTime Bound Channel Destroy Events',
        progress: 1,
        total: 1,
        append: 'TimeBoundChannelDestroyed(channel, amountRefunded)'
      })

      resolve({
        success: true
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 9. Sync Channel Setting Data
  public async getChannelSettingHistory(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all channel settings from block: %d to block: %d', fromBlock, toBlock)
      const channelSettings = await epnsAPIHelper
        .getContractEventsList(
          epnsCore.contract,
          EventType.ChannelNotifcationSettingsAdded,
          fromBlock,
          toBlock
        )
        .catch((err) => reject(err))

      logger.info(
        'Completed getChannelSettingHistory() | Number of Channels: %d',
        Object.keys(channelSettings).length
      )
      resolve(channelSettings)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncChannelSettingData(fromBlock, toBlock, blockchain, epnsCore) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Core ChannelNotifcationSettingsAdded...')

      await this.getChannelSettingHistory(fromBlock, toBlock, blockchain, epnsCore)
        .then(async (totalChannelSettingList) => {
          logger.info('Got Channel Setting List: | %o | Updating...', totalChannelSettingList)

          const channels = Container.get(Channel)
          let count = 0

          Object.keys(totalChannelSettingList).forEach(
            await async function (key) {
              logger.debug(totalChannelSettingList[key]._channel.toString())
              logger.debug(totalChannelSettingList[key])

              await channels
                .addChannelSettings(
                  `${caipId}:${totalChannelSettingList[key]._channel.toString()}`,
                  totalChannelSettingList[key]._notifSettings.toString(),
                  totalChannelSettingList[key]._notifDescription.toString()
                )
                .then((response) => {
                  logger.info(
                    'Updated Channel Setting: %s',
                    totalChannelSettingList[key]._channel.toString()
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped Updating Channel Setting: %s | Error: %o',
                    totalChannelSettingList[key]._channel.toString(),
                    err
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Unable to Set Setting Status: %s | Error: %o',
                    totalChannelSettingList[key]._channel.toString(),
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(7, {
                    chalkIt: `green.dim`,
                    title: '\ttChannel Setting Events',
                    progress: count,
                    total: Object.keys(totalChannelSettingList).length,
                    append:
                      'ChannelNotifcationSettingsAdded(_channel, _notifSettings, _notifDescription)'
                  })
                })
            }
          )

          return Object.keys(totalChannelSettingList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(7, {
        chalkIt: `green.dim`,
        title: '\tChannel Setting Events',
        progress: 1,
        total: 1,
        append: 'ChannelNotifcationSettingsAdded(_channel, _notifSettings, _notifDescription)'
      })

      resolve({
        success: true
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // Sync Core Contract Subrange
  public async syncCoreContractDataSubrange(
    fromBlock: number,
    toBlock: number,
    chainname: string,
    epnsCore: object
  ) {
    const logger = this.logger
    logger.info(`Syncing PUSH Core Contract Events`)

    logger.info(`Syncing PUSH Channel Creation/Updation`)
    const channelSyncPromise = this.syncChannelsData(fromBlock, toBlock, chainname, epnsCore)

    logger.info(`Syncing PUSH Channel Blocked`)
    const channelBlockSyncPromise = this.syncChannelBlockData(
      fromBlock,
      toBlock,
      chainname,
      epnsCore
    )

    logger.info(`Syncing PUSH Channel Deactivation`)
    const channelDeactivationSyncPromise = this.syncChannelDeactivationData(
      fromBlock,
      toBlock,
      chainname,
      epnsCore
    )

    logger.info(`Syncing PUSH Channel Reactivation`)
    const channelReactivationSyncPromise = this.syncChannelReactivationData(
      fromBlock,
      toBlock,
      chainname,
      epnsCore
    )

    logger.info(`Syncing PUSH Channel Verification`)
    const channelVerifiedSyncPromise = this.syncChannelVerifiedData(
      fromBlock,
      toBlock,
      chainname,
      epnsCore
    )

    logger.info(`Syncing PUSH Channel Unverification`)
    const channelUnverifiedSyncPromise = this.syncChannelUnverifiedData(
      fromBlock,
      toBlock,
      chainname,
      epnsCore
    )

    let channelSubgraphSyncPromise
    if (config.pushNodesNet !== 'PROD') {
      logger.info(`Syncing PUSH Channel Subgraphs`)
      channelSubgraphSyncPromise = this.syncAddSubgraphData(fromBlock, toBlock, chainname, epnsCore)
    }

    logger.info(`Syncing PUSH Time Bound Channel Destruction`)
    const timeBoundChannelDestroyedSyncPromise = this.syncTimeBoundChannelDestroyedData(
      fromBlock,
      toBlock,
      chainname,
      epnsCore
    )

    logger.info(`Syncing PUSH Channel Settings`)
    const channelSettingsSyncPromise = this.syncChannelSettingData(
      fromBlock,
      toBlock,
      chainname,
      epnsCore
    )

    return await new Promise(async (resolve, reject) => {
      let channelSyncResult,
        channelBlockSyncResult,
        channelDeactivationSyncResult,
        channelReactivationSyncResult,
        channelVerifiedSyncResult,
        channelUnverifiedSyncResult,
        channelSubgraphSyncResult,
        timeBoundChannelDestroyedSyncResult,
        channelSettingsSyncResult

      Promise.all([
        channelSyncPromise
          .then((res) => (channelSyncResult = res))
          .catch((err) => logger.error('error in channel sync: %o', err))
          .finally(() => logger.info('Done Syncing EPNS Channels | Info: %o', channelSyncResult)),
        channelBlockSyncPromise
          .then((res) => (channelBlockSyncResult = res))
          .catch((err) => logger.error('error in channel sync: %o', err))
          .finally(() =>
            logger.info('Done Syncing EPNS Channels | Info: %o', channelBlockSyncResult)
          ),
        channelDeactivationSyncPromise
          .then((res) => (channelDeactivationSyncResult = res))
          .catch((err) => logger.error('error in channel sync: %o', err))
          .finally(() =>
            logger.info('Done Syncing EPNS Channels | Info: %o', channelDeactivationSyncResult)
          ),
        channelReactivationSyncPromise
          .then((res) => (channelReactivationSyncResult = res))
          .catch((err) => logger.error('error in channel sync: %o', err))
          .finally(() =>
            logger.info('Done Syncing EPNS Channels | Info: %o', channelReactivationSyncResult)
          ),
        channelVerifiedSyncPromise
          .then((res) => (channelVerifiedSyncResult = res))
          .catch((err) => logger.error('error in channel sync: %o', err))
          .finally(() =>
            logger.info('Done Syncing EPNS Channels | Info: %o', channelVerifiedSyncResult)
          ),
        channelUnverifiedSyncPromise
          .then((res) => (channelUnverifiedSyncResult = res))
          .catch((err) => logger.error('error in channel sync: %o', err))
          .finally(() =>
            logger.info('Done Syncing EPNS Channels | Info: %o', channelUnverifiedSyncResult)
          ),
        timeBoundChannelDestroyedSyncPromise
          .then((res) => (timeBoundChannelDestroyedSyncResult = res))
          .catch((err) => logger.error('error in channel sync: %o', err))
          .finally(() =>
            logger.info(
              'Done Syncing EPNS Channels | Info: %o',
              timeBoundChannelDestroyedSyncResult
            )
          ),
        channelSettingsSyncPromise
          .then((res) => (channelSettingsSyncResult = res))
          .catch((err) => logger.error('error in channel sync: %o', err))
          .finally(() =>
            logger.info('Done Syncing EPNS Channels | Info: %o', channelSettingsSyncResult)
          )
      ])
        .then(() => {
          if (config.pushNodesNet !== 'PROD') {
            channelSubgraphSyncPromise
              .then((res) => (channelSubgraphSyncResult = res))
              .catch((err) => logger.error('error in channel sync: %o', err))
              .finally(() =>
                logger.info('Done Syncing EPNS Channels | Info: %o', channelSubgraphSyncResult)
              )
          }
        })
        .then(() => {
          const result = {
            channelSyncResult,
            channelBlockSyncResult,
            channelDeactivationSyncResult,
            channelReactivationSyncResult,
            channelVerifiedSyncResult,
            channelUnverifiedSyncResult,
            channelSubgraphSyncResult,
            timeBoundChannelDestroyedSyncResult,
            channelSettingsSyncResult
          }

          logger.info(`Completed syncCoreContractDataSubrange() with results: %o`, result)
          resolve(result)
        })
        .catch((err) => {
          logger.error('🔥 error in syncing syncCoreContractDataSubrange(): %o', err)
          reject(err)
        })
    })
  }

  public async syncCoreContractData(
    fromBlock: number,
    toBlock: number,
    chainname: string,
    epnsCore: object
  ) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger

    if (fromBlock == toBlock) {
      logger.info(
        `   -- ✔️   Start block equals last block, doing nothing; fromBlock: ${fromBlock} toBlock: ${toBlock}`
      )
      return
    }

    const blockRangeArr = BlockRangeHelper.splitBlockRangeIntoChunks(
      new BlockRangeHelper(fromBlock, toBlock),
      10000
    )
    dynamicLogger.reset()
    dynamicLogger.updatePadding(23)

    dynamicLogger.updateTitle({ chalkIt: 'green', title: 'Syncing...' })
    const logs = []
    logs[0] = [{ chalkIt: 'green', title: '...' }]

    // Turn off normal logger
    if (config.enableDynamicLogs && !dynamicLogger.isDisabled()) {
      logger.hijackLogger(dynamicLogger)
      dynamicLogger.startRendering(logger)
    }
    let count = 0
    const numOfRetry = 3
    for (const b of blockRangeArr) {
      let tries = 0
      let success = false

      while (!success) {
        tries++

        dynamicLogger.updateTitle({
          chalkIt: 'green',
          title: `Syncing Core protocol data (${count + 1} / ${blockRangeArr.length})${
            tries > 1 ? ` | Tries: (${tries} / ${numOfRetry})` : ``
          }`
        })

        dynamicLogger.updateLogs(0, {
          chalkIt: 'green',
          title: 'Syncing Core:',
          progress: count,
          total: blockRangeArr.length,
          append: `Block ${b.fromBlockInclusive} - ${b.toBlockInclusive} [till ${toBlock}] (${
            count + 1
          } / ${blockRangeArr.length})`
        })

        // Reset All Subrange
        dynamicLogger.updateLogs(1, {
          chalkIt: `green.dim`,
          title: '\tAdd Channel Events',
          progress: 0,
          total: 1,
          append: 'AddChannel(channel, channelType, identity)'
        })

        dynamicLogger.updateLogs(2, {
          chalkIt: `green.dim`,
          title: '\tChannel Blocked Events',
          progress: 0,
          total: 1,
          append: 'ChannelBlocked(_channelAddress)'
        })

        dynamicLogger.updateLogs(3, {
          chalkIt: `green.dim`,
          title: '\tChannel Deactivated Events',
          progress: 0,
          total: 1,
          append: 'DeactivateChannel(channel, totalRefundableAmount)'
        })

        dynamicLogger.updateLogs(4, {
          chalkIt: `green.dim`,
          title: '\tReactivate Channel Events',
          progress: 0,
          total: 1,
          append: 'ReactivateChannel(channel, channelType, identity)'
        })

        dynamicLogger.updateLogs(5, {
          chalkIt: `green.dim`,
          title: '\tChannel Verified Events',
          progress: 0,
          total: 1,
          append: 'ChannelVerified(channel, verifier)'
        })

        dynamicLogger.updateLogs(6, {
          chalkIt: `green.dim`,
          title: '\tChannel Unverified Events',
          progress: 0,
          total: 1,
          append: 'ChannelUnverified(channel, verifier)'
        })

        dynamicLogger.updateLogs(7, {
          chalkIt: `green.dim`,
          title: '\tChannel Setting Events',
          progress: 0,
          total: 1,
          append: 'ChannelNotifcationSettingsAdded(_channel, _notifSettings, _notifDescription)'
        })

        dynamicLogger.updateLogs(8, {
          chalkIt: `green.dim`,
          title: '\tTime Bound Channel Destroy Events',
          progress: 0,
          total: 1,
          append: 'TimeBoundChannelDestroyed(channel, amountRefunded)'
        })

        dynamicLogger.updateLogs(9, {
          chalkIt: `green.dim`,
          title: '\tChannel Subgraph Events',
          progress: 0,
          total: 1,
          append: 'AddSubGraph(channel, subGraphId, pollTime)'
        })

        await this.syncCoreContractDataSubrange(
          b.fromBlockInclusive,
          b.toBlockInclusive,
          chainname,
          epnsCore
        )
          .then(() => {
            logger.info(
              `Completed syncCoreContractDataSubrange() | Blocks - ${b.fromBlockInclusive}, ${b.toBlockInclusive} for ${chainname}`
            )
            success = true
          })
          .catch(async (err) => {
            if (tries <= numOfRetry) {
              logger.error(
                `Failed syncCoreContractDataSubrange() | Retrying... | Blocks - ${b.fromBlockInclusive}, ${b.toBlockInclusive} for ${chainname}) | ${err}`
              )
              await new Promise((r) => setTimeout(r, 1000))
            } else {
              // Number of retry exceed, do a graceful exit
              if (config.enableDynamicLogs && !dynamicLogger.isDisabled()) {
                dynamicLogger.updateFooterLogs(null)
                dynamicLogger.stopRendering()
                dynamicLogger.reset()
                logger.hijackLogger(null)
              }
              logger.error(
                `Failed syncCoreContractDataSubrange() | Exiting | Blocks - ${b.fromBlockInclusive}, ${b.toBlockInclusive} for ${chainname}) | ${err}`
              )
            }
          })

        // Update just the channel block
        const protocolMetaResponse = await updateProtocolMetaValues(
          [
            {
              type: `${config.MAP_BLOCKCHAIN_STRING_TO_CAIP[chainname]}_channel_block_number`,
              value: b.toBlockInclusive.toString()
            }
          ],
          6,
          this.logger
        )

        logger.info('Sync Blocks (Only for Channels) Updated to: %d', b.toBlockInclusive.toString())

        count++
      }

      if (count == blockRangeArr.length) {
        dynamicLogger.updateLogs(0, {
          chalkIt: 'green',
          title: 'Syncing Core:',
          progress: 1,
          total: 1,
          append: `Block ${b.fromBlockInclusive} - ${b.toBlockInclusive} (${count} / ${blockRangeArr.length})`
        })
      }
    }

    // Turn on normal logger
    if (config.enableDynamicLogs && !dynamicLogger.isDisabled()) {
      dynamicLogger.updateFooterLogs(null)
      dynamicLogger.stopRendering()
      logger.hijackLogger(null)
      dynamicLogger.reset()
    }
    logger.info('Core Protocol Sync Completed')
  }

  // -- SYNCING COMM PROTOCOL ON DIFFERENT BLOCKCHAINS
  // 1. Sync Channels Subscribers
  public async getSubscribersHistory(fromBlock: number, toBlock: number, epnsComm: InterContract) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all subscribers from block: %d to block: %d', fromBlock, toBlock)
      const subscribersList = await epnsAPIHelper.getSubscribersList(
        epnsComm.contract,
        fromBlock,
        toBlock
      )

      logger.info(
        'Completed getSubscribersHistory() | Number of Channels: %d',
        Object.keys(subscribersList.subscribeEvents).length -
          Object.keys(subscribersList.unsubscribeEvents).length
      )
      resolve(subscribersList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncSubscribersData(
    fromBlock,
    toBlock,
    blockchain,
    epnsComm: InterContract,
    verificationType
  ) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    const blockNumberToTimestamp: Map<number, number> = new Map()

    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for Channel Subscribers...')
      let count = 0

      const totalSubscribers = await this.getSubscribersHistory(fromBlock, toBlock, epnsComm)
        .then(async (obj: SubscribersResult) => {
          const subscribeEvents = obj.subscribeEvents
          const unsubscribeEvents = obj.unsubscribeEvents
          logger.info(
            'Got subscribers List (Added and Updated): | %o | Updating...',
            subscribeEvents
          )
          logger.debug('subscribeEvents: %o', subscribeEvents)
          logger.debug('unsubscribeEvents: %o', unsubscribeEvents)

          const channels = Container.get(ChannelsService)
          const totalEvents =
            Object.keys(subscribeEvents).length + Object.keys(unsubscribeEvents).length

          dynamicLogger.updateLogs(2, {
            chalkIt: `green.dim`,
            title: '\t  Channel Subcribe / Unsubscribe Events',
            progress: count,
            total: totalEvents,
            append: `Subscribe(channel, user) && Unsubscribe(channel, user) [Events: ${count}/${totalEvents}]`
          })

          Object.keys(subscribeEvents).map((channel) => {
            let users = subscribeEvents[channel].users
            const usersUnique = new Set(users)
            users = [...usersUnique]
            const usersSubscribePromise = users.map((userEntry) => {
              // userEntry = ${subscriber}:${signature}:${blockNumber}
              const userFieldsArr = userEntry.split(':')
              const subscriber = userFieldsArr[0]
              const signature = userFieldsArr[1]
              const blockNumber = NumUtil.parseInt(userFieldsArr[2], null)
              count++

              dynamicLogger.updateLogs(2, {
                chalkIt: `green.dim`,
                title: '\t  Channel Subs / Unsubs Events',
                progress: count,
                total: totalEvents,
                append: `Subscribe(channel, user) && Unsubscribe(channel, user) [Events: ${count}/${totalEvents}]`
              })

              return this.fetchBlockTimestampWithCache(
                epnsComm,
                blockNumberToTimestamp,
                blockNumber
              ).then((blockTimestamp) => {
                return channels.addExternalSubscribers(
                  `${caipId}:${signature}`,
                  {
                    channel: channel,
                    subscriber: subscriber
                  },
                  config.MAP_BLOCKCHAIN_STRING_TO_ID[blockchain],
                  verificationType,
                  blockTimestamp,
                  'onchain'
                )
              })
            })
            Promise.all(usersSubscribePromise)
              .then((response) => {
                logger.info('Subscribed users to Channel')
              })
              .catch((err) => {
                logger.warn('Skipped subscribing users to Channel: Error: %o', err.message)
              })
              .finally(() => {
                dynamicLogger.updateLogs(2, {
                  chalkIt: `green.dim`,
                  title: '\t  Channel Subs / Unsubs Events',
                  progress: count,
                  total: totalEvents,
                  append: `Subscribe(channel, user) && Unsubscribe(channel, user) [Events: ${count}/${totalEvents}]`
                })
              })
          })

          Object.keys(unsubscribeEvents).map((channel) => {
            let users = unsubscribeEvents[channel].users
            const usersUnique = new Set(users)
            users = [...usersUnique]
            const usersUnSubscribePromise = users.map((userEntry) => {
              // userEntry = ${subscriber}:${signature}:${blockNumber}
              const userFieldsArr = userEntry.split(':')
              const subscriber = userFieldsArr[0]
              const signature = userFieldsArr[1]
              const blockNumber = NumUtil.parseInt(userFieldsArr[2], null)
              count++

              dynamicLogger.updateLogs(2, {
                chalkIt: `green.dim`,
                title: '\t  Channel Subs / Unsubs Events',
                progress: count,
                total: totalEvents,
                append: `Subscribe(channel, user) && Unsubscribe(channel, user) [Events: ${count}/${totalEvents}]`
              })

              return this.fetchBlockTimestampWithCache(
                epnsComm,
                blockNumberToTimestamp,
                blockNumber
              ).then((blockTimestamp) => {
                return channels.removeExternalSubscribers(
                  `${caipId}:${signature}`,
                  {
                    channel: channel,
                    unsubscriber: subscriber
                  },
                  config.MAP_BLOCKCHAIN_STRING_TO_ID[blockchain],
                  verificationType,
                  blockTimestamp
                )
              })
            })
            Promise.all(usersUnSubscribePromise)
              .then((response) => {
                logger.info('Unsubscribed user from Channel')
              })
              .catch((err) => {
                logger.warn('Skipped unsubscribing user from Channel: Error: %o', err.message)
              })
              .finally(() => {
                dynamicLogger.updateLogs(2, {
                  chalkIt: `green.dim`,
                  title: '\t  Channel Subs / Unsubs Events',
                  progress: count,
                  total: totalEvents,
                  append: `Subscribe(channel, user) && Unsubscribe(channel, user) [Events: ${count}/${totalEvents}]`
                })
              })
          })

          logger.debug('Total Subscribed Number: %o', Object.keys(subscribeEvents).length)
          logger.debug('Total Unsubscribed Number: %o', Object.keys(unsubscribeEvents).length)

          return {
            subscribed: Object.keys(unsubscribeEvents).length,
            unsubscribed: Object.keys(unsubscribeEvents).length
          }
        })
        .catch((err) => {
          logger.error(err)
        })

      dynamicLogger.updateLogs(2, {
        chalkIt: `green.dim`,
        title: '\t  Channel Subs / Unsubs Events',
        progress: 1,
        total: 1,
        append: `Subscribe(channel, user) && Unsubscribe(channel, user) [Events: ${count}/${count}]`
      })

      resolve({
        subscribed: totalSubscribers.subscribed,
        unsubscribed: totalSubscribers.unsubscribed
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 2. Sync Channel Aliases
  public async getAliasHistory(fromBlock, toBlock, epnsComm) {
    const logger = this.logger
    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all messages from block: %d to block: %d', fromBlock, toBlock)
      const aliasList = await epnsAPIHelper.getChannelAliasList(
        epnsComm.contract,
        fromBlock,
        toBlock
      )
      logger.debug('Channel Alias List: %o', aliasList)

      logger.info(
        'Completed getAliasHistory() | Number of channel alias: %d',
        Object.keys(aliasList).length
      )
      resolve(aliasList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 2. Sync Remove Channel Aliases
  public async getRemoveAliasHistory(fromBlock, toBlock, epnsComm) {
    const logger = this.logger
    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all messages from block: %d to block: %d', fromBlock, toBlock)

      const aliasList = await epnsAPIHelper.getRemoveChannelAliasList(
        epnsComm.contract,
        fromBlock,
        toBlock,
        true
      )
      logger.debug('Remove Channel Alias List: %o', aliasList)

      logger.info(
        'Completed getRemoveAliasHistory() | Number of channel alias: %d',
        Object.keys(aliasList).length
      )
      resolve(aliasList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncAliasData(fromBlock, toBlock, epnsComm, blockchain) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Communicator Alias...')

      const aliasClass = Container.get(Alias)
      let count = 0

      const totalAlias = await this.getAliasHistory(fromBlock, toBlock, epnsComm)
        .then(async (aliasList) => {
          logger.info('Got alias List (SendMessage): | %o | Updating...', aliasList)

          Object.keys(aliasList).forEach(
            await async function (key) {
              logger.debug('Channel Alias Object: %o', aliasList[key])
              logger.debug(
                'Channel Alias List Chain IDs: %s',
                aliasList[key].args._chainID.toString()
              )

              await channelAndAliasHelper.ingestChannelAliasAddress(
                aliasClass,
                caipId,
                `${aliasList[key].args._channelOwnerAddress}`,
                aliasList[key].args._ethereumChannelAddress,
                `${caipId}:${aliasList[key].transactionHash}`
              )

              await aliasClass
                .checkAndUpdateAlias(
                  getChannelAddressfromEthAddress(aliasList[key].args._ethereumChannelAddress),
                  `${caipId}:${aliasList[key].args._channelOwnerAddress}`,
                  aliasList[key].args._chainID.toString(),
                  `${caipId}:${aliasList[key].transactionHash}`
                )
                .then((response) => {
                  logger.info(
                    'Added Channel Alies: %s | %d | %s | %s',
                    aliasList[key].args._chainName,
                    aliasList[key].args._chainID,
                    aliasList[key].args._channelOwnerAddress,
                    aliasList[key].args._ethereumChannelAddress
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped Adding alias: %s | Error: %o',
                    aliasList[key].args._channelOwnerAddress,
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(3, {
                    chalkIt: `green.dim`,
                    title: '\t  Channel Alias Events',
                    progress: count,
                    total: Object.keys(aliasList).length,
                    append: `ChannelAlias(_chainName, _chainID, _channelOwnerAddress, _ethereumChannelAddress) [Events: ${count}/${
                      Object.keys(aliasList).length
                    }]`
                  })
                })
            }
          )

          return Object.keys(aliasList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(3, {
        chalkIt: `green.dim`,
        title: '\t  Channel Alias Events',
        progress: 1,
        total: 1,
        append: `ChannelAlias(_chainName, _chainID, _channelOwnerAddress, _ethereumChannelAddress) [Events: ${count}/${count}]`
      })

      resolve({
        totalAlias
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // Sync Remove Channel Alias
  public async syncRemoveAliasData(fromBlock, toBlock, epnsComm, blockchain) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]

    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Communicator Remove Alias...')

      const aliasClass = Container.get(Alias)
      let count = 0

      const totalAlias = await this.getRemoveAliasHistory(fromBlock, toBlock, epnsComm)
        .then(async (aliasList) => {
          logger.info('Got remove channel alias List (SendMessage): | %o | Updating...', aliasList)

          Object.keys(aliasList).forEach(
            await async function (key) {
              logger.debug('Remove Channel Alias Object: %o', aliasList[key])
              logger.debug(
                'Remove Channel Alias List Chain IDs: %s',
                aliasList[key]._chainID.toString()
              )

              await aliasClass
                .removeChannelAlias(
                  `${caipId}:${aliasList[key]._channelOwnerAddress}`,
                  aliasList[key]._baseChannelAddress
                )
                .then((response) => {
                  logger.info(
                    'Removed Channel Alies: %s | %d | %s | %s',
                    aliasList[key]._chainName,
                    aliasList[key]._chainID,
                    aliasList[key]._channelOwnerAddress,
                    aliasList[key]._baseChannelAddress
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped Removing alias: %s | Error: %o',
                    aliasList[key]._baseChannelAddress,
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(3, {
                    chalkIt: `green.dim`,
                    title: '\t  Remove Channel Alias Events',
                    progress: count,
                    total: Object.keys(aliasList).length,
                    append: `ChannelAlias(_chainName, _chainID, _channelOwnerAddress, _baseChannelAddress) [Events: ${count}/${
                      Object.keys(aliasList).length
                    }]`
                  })
                })
            }
          )

          return Object.keys(aliasList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(3, {
        chalkIt: `green.dim`,
        title: '\t  Remove Channel Alias Events',
        progress: 1,
        total: 1,
        append: `RemoveChannelAlias(_chainName, _chainID, _channelOwnerAddress, _baseChannelAddress) [Events: ${count}/${count}]`
      })

      resolve({
        totalAlias
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 3. Sync Channels Delegates
  public async getChannelAddDelegateHistory(fromBlock, toBlock, epnsComm) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all messages from block: %d to block: %d', fromBlock, toBlock)
      const delegateList = await epnsAPIHelper.getContractEventsList(
        epnsComm.contract,
        EventType.AddDelegate,
        fromBlock,
        toBlock
      )

      logger.info(
        'Completed getChannelAddDelegateHistory() | Number of channel alias: %d',
        Object.keys(delegateList).length
      )
      resolve(delegateList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncChannelAddDelegateData(fromBlock, toBlock, blockchain, epnsComm) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Communicator Delegate...')
      let count = 0

      const totalChannelDelegates = await this.getChannelAddDelegateHistory(
        fromBlock,
        toBlock,
        epnsComm
      )
        .then(async (delegateList) => {
          logger.info('Got alias List (SendMessage): | %o | Updating...', delegateList)
          const channels = Container.get(Channel)

          await Object.keys(delegateList).forEach(async (key) => {
            logger.debug('Channel Add Delegate Object: %o', delegateList[key])

            await channels
              .setDelegateeAddress(
                `${caipId}:${delegateList[key].channel}`,
                `${caipId}:${delegateList[key].delegate}`
              )
              .then(() => {
                logger.info(
                  'Added Channel Delegate: %s | %s ',
                  delegateList[key].channel,
                  delegateList[key].delegate
                )
              })
              .catch((err) => {
                logger.warn(
                  'Skipped Adding delegate: %s | Error: %o',
                  delegateList[key].channel,
                  err
                )
              })
              .finally(() => {
                count++

                dynamicLogger.updateLogs(4, {
                  chalkIt: `green.dim`,
                  title: '\t  Channel Added Delegates',
                  progress: count,
                  total: Object.keys(delegateList).length,
                  append: `AddDelegate(address channel, address delegate) [Events: ${count}/${
                    Object.keys(delegateList).length
                  }]`
                })
              })
          })

          return Object.keys(delegateList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(4, {
        chalkIt: `green.dim`,
        title: '\t  Channel Added Delegates',
        progress: 1,
        total: 1,
        append: `AddDelegate(address channel, address delegate) [Events: ${count}/${count}]`
      })

      resolve({
        totalChannelDelegates
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 4. Sync Channels Removed Delegates
  public async getChannelRemoveDelegateHistory(fromBlock, toBlock, epnsComm) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all messages from block: %d to block: %d', fromBlock, toBlock)
      const aliasRemovalList = await epnsAPIHelper.getContractEventsList(
        epnsComm.contract,
        EventType.RemoveDelegate,
        fromBlock,
        toBlock
      )
      logger.debug('Channel Alias List: %o', aliasRemovalList)

      logger.info(
        'Completed getChannelRemoveDelegateHistory() | Number of channel alias: %d',
        Object.keys(aliasRemovalList).length
      )
      resolve(aliasRemovalList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncChannelRemoveDelegateData(fromBlock, toBlock, blockchain, epnsComm) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Communicator Delegate...')

      const channels = Container.get(Channel)
      let count = 0

      const totalChannelDelegates = await this.getChannelRemoveDelegateHistory(
        fromBlock,
        toBlock,
        epnsComm
      )
        .then(async (delegateList) => {
          logger.info('Got alias List (SendMessage): | %o | Updating...', delegateList)

          Object.keys(delegateList).forEach(
            await async function (key) {
              logger.debug('Channel Removed Delegate Object: %o', delegateList[key])

              await channels
                .removeDelegateeAddress(
                  `${caipId}:${delegateList[key].channel}`,
                  `${caipId}:${delegateList[key].delegate}`
                )
                .then((response) => {
                  logger.info(
                    'Removed Channel Delegate: %s | %s ',
                    delegateList[key].channel,
                    delegateList[key].delegate
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped removing delegate: %s | Error: %o',
                    delegateList[key].channel,
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(5, {
                    chalkIt: `green.dim`,
                    title: '\t  Channel Removed Delegates',
                    progress: count,
                    total: Object.keys(delegateList).length,
                    append: `RemoveDelegate(address channel, address delegate) [Events: ${count}/${
                      Object.keys(delegateList).length
                    }]`
                  })
                })
            }
          )

          return Object.keys(delegateList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(5, {
        chalkIt: `green.dim`,
        title: '\t  Channel Removed Delegates',
        progress: 1,
        total: 1,
        append: `RemoveDelegate(address channel, address delegate) [Events: ${count}/${count}]`
      })

      resolve({
        totalChannelDelegates
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 5. Sync Notification Payloads
  public async getNotificationsHistory(fromBlock, toBlock, epnsComm) {
    const logger = this.logger

    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all messages from block: %d to block: %d', fromBlock, toBlock)
      const notificationsList = await epnsAPIHelper.getNotificationsList(
        epnsComm.contract,
        fromBlock,
        toBlock
      )

      logger.info(
        'Completed getNotificationsHistory() | Number of messages: %d',
        Object.keys(notificationsList).length
      )
      resolve(notificationsList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncNotificationsData(fromBlock, toBlock, blockchain, epnsComm, verificationType) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Notifications...')
      let count = 0

      const totalNotifications = await this.getNotificationsHistory(fromBlock, toBlock, epnsComm)
        .then(async (notificationsList) => {
          logger.info('Got Notifications List (SendMessage): | %o | Updating...', notificationsList)

          const payloads = Container.get(PayloadsService)

          Object.keys(notificationsList).forEach(
            await async function (key) {
              await payloads
                .addExternalPayload(
                  verificationType + VERIFICATION_PROOF_DELIMITER + notificationsList[key].trxHash,
                  `${caipId}:${notificationsList[key].channel}`,
                  config.senderType.channel,
                  `eip155:${notificationsList[key].recipient}`,
                  blockchain,
                  notificationsList[key].identity
                )
                .then((response) => {
                  logger.info(
                    'Added Payloads: %s | %d | %s',
                    notificationsList[key].channel,
                    notificationsList[key].recipient,
                    notificationsList[key].identity
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped Adding Notifications: %s | Error: %o',
                    notificationsList[key].channel,
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(6, {
                    chalkIt: `green.dim`,
                    title: '\t  Notif Payloads',
                    progress: count,
                    total: Object.keys(notificationsList).length,
                    append: `SendNotification(channel, recipient, identity) [Events: ${count}/${
                      Object.keys(notificationsList).length
                    }]`
                  })
                })
            }
          )

          return Object.keys(notificationsList).length
        })
        .catch((err) => {
          logger.error(err)
        })

      dynamicLogger.updateLogs(6, {
        chalkIt: `green.dim`,
        title: '\t  Notif Payloads',
        progress: 1,
        total: 1,
        append: `SendNotification(channel, recipient, identity) [Events: ${count}/${count}]`
      })

      resolve({
        totalNotifications
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // 6. User Settings
  public async getUserSettingHistory(fromBlock, toBlock, epnsComm) {
    const logger = this.logger
    return await new Promise(async (resolve, reject) => {
      logger.info('Getting all messages from block: %d to block: %d', fromBlock, toBlock)
      const aliasList = await epnsAPIHelper.getUserSettingList(
        epnsComm.contract,
        fromBlock,
        toBlock
      )
      logger.debug('User Setting List: %o', aliasList)

      logger.info(
        'Completed getUserSettingHistory() | Number of user setting: %d',
        Object.keys(aliasList).length
      )
      resolve(aliasList)
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  public async syncUserSettingData(fromBlock, toBlock, epnsComm, blockchain) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger
    const caipId = config.MAP_BLOCKCHAIN_STRING_TO_CAIP[blockchain]
    return await new Promise(async (resolve, reject) => {
      logger.info('Prepping for Sync-up for EPNS Communicator User Setting...')

      const channel = Container.get(ChannelsService)
      let count = 0

      const totalSetting = await this.getUserSettingHistory(fromBlock, toBlock, epnsComm)
        .then(async (userSettingList) => {
          logger.info('Got user setting List: | %o | Updating...', userSettingList)

          Object.keys(userSettingList).forEach(
            await async function (key) {
              logger.debug('User Setting Object: %o', userSettingList[key])
              logger.debug(
                'User Setting List Chain IDs: %s',
                userSettingList[key]._chainID.toString()
              )

              await channel
                .setUserSetting(
                  `eip155${userSettingList[key]._user}`,
                  `${caipId}:${userSettingList[key]._channel}`,
                  userSettingList[key]._notifSettings
                )
                .then((response) => {
                  logger.info(
                    'Added User Setting: %s | %d | %s | %s',
                    userSettingList[key]._user,
                    userSettingList[key]._channel,
                    userSettingList[key]._notifSettings
                  )
                })
                .catch((err) => {
                  logger.warn(
                    'Skipped Adding User Setting: %s | Error: %o',
                    userSettingList[key]._channelOwnerAddress,
                    err
                  )
                })
                .finally(() => {
                  count++

                  dynamicLogger.updateLogs(3, {
                    chalkIt: `green.dim`,
                    title: '\t  Channel Alias Events',
                    progress: count,
                    total: Object.keys(userSettingList).length,
                    append: `UserNotifcationSettingsAdded(
                      address _channel,
                      address _user,
                      uint256 _notifID,
                      string _notifSettings
                  ) [Events: ${count}/${Object.keys(userSettingList).length}]`
                  })
                })
            }
          )

          return Object.keys(userSettingList).length
        })
        .catch((err) => {
          logger.error(err)
          reject(err)
        })

      dynamicLogger.updateLogs(3, {
        chalkIt: `green.dim`,
        title: '\t  User Setting Events',
        progress: 1,
        total: 1,
        append: `UserNotifcationSettingsAdded(
          address _channel,
          address _user,
          uint256 _notifID,
          string _notifSettings
      ) [Events: ${count}/${count}]`
      })

      resolve({
        totalSetting
      })
    }).catch((err) => {
      logger.error(err)
      reject(err)
    })
  }

  // Sync Comm Contract Data
  public async syncCommContractDataSubrange(
    fromBlock: number,
    toBlock: number,
    chainname: string,
    syncup: { subs: boolean; payload: boolean },
    epnsComm: object,
    verificationType: string
  ) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger

    logger.info(`Syncing EPNS Comm Contract Events`)

    let subscribersSyncPromise,
      channelAliasSyncPromise,
      removeChannelAliasSyncPromise,
      channelAddDelegatesSyncPromise,
      channelRemoveDelegatesSyncPromise,
      payloadsSyncPromise,
      userSettingSyncPromise

    if (syncup.subs) {
      logger.info(`Syncing Channel Subscribers`)
      subscribersSyncPromise = this.syncSubscribersData(
        fromBlock,
        toBlock,
        chainname,
        epnsComm,
        verificationType
      )

      logger.info(`Syncing Channel Aliases`)
      channelAliasSyncPromise = this.syncAliasData(fromBlock, toBlock, epnsComm, chainname)

      logger.info(`Syncing Remove Channel Aliases`)
      removeChannelAliasSyncPromise = this.syncRemoveAliasData(
        fromBlock,
        toBlock,
        epnsComm,
        chainname
      )

      logger.info(`Syncing Channel Add Delegates`)
      channelAddDelegatesSyncPromise = this.syncChannelAddDelegateData(
        fromBlock,
        toBlock,
        chainname,
        epnsComm
      )

      logger.info(`Syncing Channel Remove Delegates`)
      channelRemoveDelegatesSyncPromise = this.syncChannelRemoveDelegateData(
        fromBlock,
        toBlock,
        chainname,
        epnsComm
      )

      logger.info(`Syncing User Setting`)
      userSettingSyncPromise = this.syncUserSettingData(fromBlock, toBlock, epnsComm, chainname)
    } else {
      logger.info(`Already Synced Subscribers Data... Skipping`)

      subscribersSyncPromise = new Promise((r) => r(true))
      channelAliasSyncPromise = new Promise((r) => r(true))
      removeChannelAliasSyncPromise = new Promise((r) => r(true))
      channelAddDelegatesSyncPromise = new Promise((r) => r(true))
      channelRemoveDelegatesSyncPromise = new Promise((r) => r(true))
      userSettingSyncPromise = new Promise((r) => r(true))

      dynamicLogger.updateLogs(2, {
        chalkIt: `green.dim`,
        title: '\t  Channel Subs / Unsubs Events',
        progress: 1,
        total: 1,
        append: 'Subscribe(channel, user) && Unsubscribe(channel, user) [Skipped]'
      })

      dynamicLogger.updateLogs(3, {
        chalkIt: `green.dim`,
        title: '\t  Channel Alias Events',
        progress: 1,
        total: 1,
        append:
          'ChannelAlias(_chainName, _chainID, _channelOwnerAddress, _ethereumChannelAddress) [Skipped]'
      })

      dynamicLogger.updateLogs(4, {
        chalkIt: `green.dim`,
        title: '\t  Channel Added Delegates',
        progress: 1,
        total: 1,
        append: 'AddDelegate(address channel, address delegate) [Skipped]'
      })

      dynamicLogger.updateLogs(5, {
        chalkIt: `green.dim`,
        title: '\t  Channel Removed Delegates',
        progress: 1,
        total: 1,
        append: 'RemoveDelegate(address channel, address delegate) [Skipped]'
      })

      dynamicLogger.updateLogs(5, {
        chalkIt: `green.dim`,
        title: '\t  User Setting Added',
        progress: 1,
        total: 1,
        append: `UserNotifcationSettingsAdded(
          address _channel,
          address _user,
          uint256 _notifID,
          string _notifSettings
      ) [Skipped]`
      })

      dynamicLogger.updateLogs(6, {
        chalkIt: `green.dim`,
        title: '\t  Remove Channel Alias Events',
        progress: 1,
        total: 1,
        append:
          'RemoveChannelAlias(_chainName, _chainID, _channelOwnerAddress, _baseChannelAddress) [Skipped]'
      })
    }

    if (syncup.payload) {
      logger.info(`Syncing Notification Payloads`)
      payloadsSyncPromise = this.syncNotificationsData(
        fromBlock,
        toBlock,
        chainname,
        epnsComm,
        verificationType
      )
    } else {
      logger.info(`Already Synced Payloads Data... Skipping`)

      payloadsSyncPromise = new Promise((r) => r(true))

      dynamicLogger.updateLogs(6, {
        chalkIt: `green.dim`,
        title: '\t  Notif Payloads',
        progress: 1,
        total: 1,
        append: 'SendNotification(channel, recipient, identity) [Skipped]'
      })
    }

    return await new Promise(async (resolve, reject) => {
      let subscribersSyncResult,
        channelAliasSyncResult,
        removeChannelAliasSyncResult,
        channelAddDelegatesSyncResult,
        channelRemoveDelegatesSyncResult,
        payloadsSyncResult,
        userSyncResult

      Promise.all([
        subscribersSyncPromise
          .then((res) => (subscribersSyncResult = res))
          .catch((err) => logger.error('error in subscribers sync: %o', err))
          .finally(() =>
            logger.info(
              'Done Syncing Channel Subscribers / Unsubscribers | Info: %o',
              subscribersSyncResult
            )
          ),
        channelAliasSyncPromise
          .then((res) => (channelAliasSyncResult = res))
          .catch((err) => logger.error('error in channel aliases sync: %o', err))
          .finally(() =>
            logger.info('Done Syncing Channel Aliases | Info: %o', channelAliasSyncResult)
          ),
        removeChannelAliasSyncPromise
          .then((res) => (removeChannelAliasSyncResult = res))
          .catch((err) => logger.error('error in remove channel aliases sync: %o', err))
          .finally(() =>
            logger.info(
              'Done Syncing Remove Channel Aliases | Info: %o',
              removeChannelAliasSyncResult
            )
          ),
        channelAddDelegatesSyncPromise
          .then((res) => (channelAddDelegatesSyncResult = res))
          .catch((err) => logger.error('error in channel delegates sync: %o', err))
          .finally(() =>
            logger.info('Done Syncing Channel Delegates | Info: %o', channelAddDelegatesSyncResult)
          ),
        channelRemoveDelegatesSyncPromise
          .then((res) => (channelRemoveDelegatesSyncResult = res))
          .catch((err) => logger.error('error in removing channel delegates  sync: %o', err))
          .finally(() =>
            logger.info(
              'Done Remove Channel Deleagtes | Info: %o',
              channelRemoveDelegatesSyncResult
            )
          ),
        payloadsSyncPromise
          .then((res) => (payloadsSyncResult = res))
          .catch((err) => logger.error('error in payload sync: %o', err))
          .finally(() => logger.info('Done Syncing Payload | Info: %o', payloadsSyncResult)),
        userSettingSyncPromise
          .then((res) => (userSyncResult = res))
          .catch((err) => logger.error('error in user setting sync: %o', err))
          .finally(() => logger.info('Done Syncing User Setting | Info: %o', userSyncResult))
      ])
        .then(() => {
          const result = {
            subscribersSyncResult,
            channelAliasSyncResult,
            removeChannelAliasSyncResult,
            channelAddDelegatesSyncResult,
            channelRemoveDelegatesSyncResult,
            payloadsSyncResult,
            userSyncResult
          }

          logger.info(`Completed syncCommContractDataSubrange() with results: %o`, result)
          resolve(result)
        })
        .catch((err) => {
          logger.error('error in syncing syncCommContractDataSubrange(): %o', err)
          reject(err)
        })
    })
  }

  // Sync Comm Contract Data
  public async syncCommContractData(
    fromSubsBlock: number,
    fromPayloadsBlock: number,
    toBlock: number,
    chainname: string,
    epnsComm: object,
    verificationType: string
  ) {
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger

    logger.info('Syncing Comm Protocol')
    if (fromSubsBlock == fromPayloadsBlock && fromPayloadsBlock == toBlock) {
      logger.info(
        `Start block equals last block, doing nothing; fromBlock: ${fromSubsBlock} toBlock: ${toBlock}`
      )
      return
    }
    const blockRangeArr = HistoryFetcherService.calculateBlockRange(
      logger,
      fromSubsBlock,
      fromPayloadsBlock,
      toBlock,
      config.MAP_BLOCKCHAIN_STRING_TO_ID[chainname] === config.berachainChainId ? 1000 : 10000
    )
    let count = 0
    const numOfRetry = 3

    if (blockRangeArr.length > 0) {
      let numberOfBlockRanges = 0

      for (const b of blockRangeArr) {
        let tries = 0
        let success = false
        while (!success) {
          tries++

          await new Promise((r) => setTimeout(r, 1000))
          // Reset All Subrange
          dynamicLogger.updateLogs(1, {
            chalkIt: 'grey.bold',
            title: `\tChain - ${chainname}`,
            progress: count,
            total: blockRangeArr.length,
            append: `Block ${b.fromBlockInclusive} - ${b.toBlockInclusive} (${count + 1} / ${
              blockRangeArr.length
            })${tries > 1 ? ` | Tries: (${tries} / ${numOfRetry})` : ``}`
          })

          dynamicLogger.updateLogs(2, {
            chalkIt: `green.dim`,
            title: '\t  Channel Subs / Unsubs Events',
            progress: 0,
            total: 1,
            append: 'Subscribe(channel, user) && Unsubscribe(channel, user)'
          })

          dynamicLogger.updateLogs(3, {
            chalkIt: `green.dim`,
            title: '\t  Channel Alias Events',
            progress: 0,
            total: 1,
            append:
              'ChannelAlias(_chainName, _chainID, _channelOwnerAddress, _ethereumChannelAddress)'
          })

          dynamicLogger.updateLogs(4, {
            chalkIt: `green.dim`,
            title: '\t  Channel Added Delegates',
            progress: 0,
            total: 1,
            append: 'AddDelegate(address channel, address delegate)'
          })

          dynamicLogger.updateLogs(5, {
            chalkIt: `green.dim`,
            title: '\t  Channel Removed Delegates',
            progress: 0,
            total: 1,
            append: 'RemoveDelegate(address channel, address delegate)'
          })

          dynamicLogger.updateLogs(6, {
            chalkIt: `green.dim`,
            title: '\t  Notif Payloads',
            progress: 0,
            total: 1,
            append: 'SendNotification(channel, recipient, identity)'
          })

          dynamicLogger.updateLogs(7, {
            chalkIt: `green.dim`,
            title: '\t  Remove Channel Alias Events',
            progress: 0,
            total: 1,
            append:
              'RemoveChannelAlias(_chainName, _chainID, _channelOwnerAddress, _baseChannelAddress)'
          })

          // Sync up subs before payloads block
          await this.syncCommContractDataSubrange(
            b.fromBlockInclusive,
            b.toBlockInclusive,
            chainname,
            b.meta,
            epnsComm,
            verificationType
          )
            .then(() => {
              logger.info(
                `Completed syncCommContractDataSubrange() | Blocks - ${b.fromBlockInclusive}, ${b.toBlockInclusive}, ${b.meta} for ${chainname}`
              )
              success = true
            })
            .catch(async (err) => {
              if (tries <= numOfRetry) {
                logger.error(
                  `Failed syncCommContractDataSubrange() | Retrying... | Blocks - ${b.fromBlockInclusive}, ${b.toBlockInclusive} for ${chainname}) | ${err}`
                )
                await new Promise((r) => setTimeout(r, 1000))
              } else {
                // Number of retry exceed, do a graceful exit
                if (config.enableDynamicLogs && !dynamicLogger.isDisabled()) {
                  dynamicLogger.updateFooterLogs(null)
                  dynamicLogger.stopRendering()
                  dynamicLogger.reset()
                  logger.hijackLogger(null)
                }

                logger.error(
                  `Failed syncCommContractDataSubrange() | Exiting | Blocks - ${b.fromBlockInclusive}, ${b.toBlockInclusive} for ${chainname}) | ${err}`
                )
              }
            })
            .finally(async () => {
              const protocololMetaValues = []

              if (b.meta.subs) {
                protocololMetaValues.push({
                  type: `${config.MAP_BLOCKCHAIN_STRING_TO_CAIP[chainname]}_subscriber_block_number`,
                  value: b.toBlockInclusive.toString()
                })
              }

              if (b.meta.payload) {
                protocololMetaValues.push({
                  type: `${config.MAP_BLOCKCHAIN_STRING_TO_CAIP[chainname]}_payload_block_number`,
                  value: b.toBlockInclusive.toString()
                })
              }

              const protocolMetaResponse = await updateProtocolMetaValues(
                protocololMetaValues,
                6,
                this.logger
              )
              logger.info(
                'Sync Blocks (Only for Subs / Payloads) Updated to: %d',
                b.toBlockInclusive.toString()
              )
            })

          count++
        }

        numberOfBlockRanges++
        if (blockRangeArr.length == numberOfBlockRanges) {
          // Reset All Subrange
          dynamicLogger.updateLogs(1, {
            chalkIt: 'grey.bold',
            title: `\tChain - ${chainname}`,
            progress: 1,
            total: 1,
            append: `Block ${b.fromBlockInclusive} - ${b.toBlockInclusive} (${count} / ${
              blockRangeArr.length
            })${tries > 1 ? ` | Tries: (${tries} / ${numOfRetry})` : ``}`
          })
        }
      }
    }

    return true
  }

  public static calculateBlockRange(
    logger,
    fromSubsBlock: number,
    fromPayloadsBlock: number,
    toBlock: number,
    maxChunkSize: number
  ): BlockRangeHelper[] {
    // 1. add chunks for lagging block type (subs or payloads), with right flags (subs=true, or paylod=true)
    let headArr = []
    if (fromSubsBlock < fromPayloadsBlock) {
      logger.debug(`Subs block lags behind, will do sync up to ${fromPayloadsBlock}`)
      headArr = BlockRangeHelper.splitBlockRangeIntoChunks(
        new BlockRangeHelper(fromSubsBlock, fromPayloadsBlock),
        maxChunkSize
      )
      for (const i of headArr) {
        i.meta = { subs: true, payload: false }
      }
      logger.debug('headArr: ' + BlockRangeHelper.toString(headArr))
    } else if (fromPayloadsBlock < fromSubsBlock) {
      logger.debug(`Payloads block lags behind, will do sync up to ${fromSubsBlock}`)
      headArr = BlockRangeHelper.splitBlockRangeIntoChunks(
        new BlockRangeHelper(fromPayloadsBlock, fromSubsBlock),
        maxChunkSize
      )
      for (const i of headArr) {
        i.meta = { subs: false, payload: true }
      }
      // logger.debug('headArr: ' + BlockRangeHelper.toString(headArr));
    } else {
      logger.debug(`Subs block equals payloads block `)
    }

    // 2. add chunks for both block type (subs + payloads), with right flags (subs=true, paylod=true)
    let headLastIncluded = Math.max(fromPayloadsBlock, fromSubsBlock)
    if (headArr.length > 0) {
      headLastIncluded++
    }
    const tailArr = BlockRangeHelper.splitBlockRangeIntoChunks(
      new BlockRangeHelper(headLastIncluded, toBlock),
      maxChunkSize
    )
    for (const i of tailArr) {
      i.meta = { subs: true, payload: true }
    }
    // logger.debug('tailArr: ' + BlockRangeHelper.toString(tailArr));

    return [...headArr, ...tailArr]
  }

  // To sync up EPNS Protocol and Running Node
  public async syncProtocolData(isStartup = true) {
    //isStartup is used to check if the sync is happening when the server starts or from cron task
    // ideally we wont want to block the apis when the cron task kicks in the middle of server opeartion
    // if (isStartup) await redisClient.set(config.syncStatus, 'false')
    const logger = this.logger
    const dynamicLogger = this.dynamicLogger

    // define the amount of padding for logs
    const offset = 6

    return await new Promise(async (resolve, reject) => {
      let coreResponse, commResponse

      const forTypes = [`${config.protocolMeta[0].row}_channel_block_number`]

      for (let i = 0; i < config.protocolMeta.length; i++) {
        forTypes.push(`${config.protocolMeta[i].row}_subscriber_block_number`)
        forTypes.push(`${config.protocolMeta[i].row}_payload_block_number`)
      }

      // 1. Get Protocol Meta Sync Blocks
      let protocolSyncBlocks: object = {}
      for (let i = 0; i < BLOCKCHAIN_TYPE.length; i++) {
        const blockchain: string = BLOCKCHAIN_TYPE[i].toString()

        await getProtocolMetaValues(forTypes, offset, logger)
          .then((protocolMeta) => {
            protocolSyncBlocks = protocolMeta
          })
          .catch((err) => {
            logger.error('error in retriving protocol sync blocks: %o', err)
            reject(err)
          })
      }

      // 2. Get epnsCore contract
      const epnsCore = await this.getInteractableContract(
        CORE_BLOCKCHAIN_TYPE,
        CONTRACT_TYPE[0],
        offset
      )

      // 3. Get latest block number and sync CORE Protocol
      // HANDLE ISSUE: START OF DYNAMIC LOG EATS ONE LINE
      logger.info('Syncing Core Protocol')

      await epnsCore.provider
        .getBlockNumber()
        .then(async (latestBlock) => {
          // Sync EPNSCore
          let channelLastUpdate = parseInt(
            protocolSyncBlocks[`${config.protocolMeta[0].row}_channel_block_number`]
          )

          if (channelLastUpdate == null) {
            channelLastUpdate = 0
          }

          coreResponse = await this.syncCoreContractData(
            channelLastUpdate,
            latestBlock,
            CORE_BLOCKCHAIN_TYPE,
            epnsCore
          )
        })
        .catch((err) => {
          logger.error('error in retriving latest block number for EPNSCore: %o', err)
          reject(err)
        })

      // 4. sync PUSH Communication Protocol
      logger.info('Syncing Comm Protocol Data')
      const logs = []
      logs[0] = [{ chalkIt: 'green', title: '...' }]

      if (config.enableDynamicLogs && !dynamicLogger.isDisabled()) {
        dynamicLogger.reset()
        dynamicLogger.startRendering(logger)
        dynamicLogger.updatePadding(23)
        dynamicLogger.updateEntireLogs(logs)
        dynamicLogger.updateTitle({
          chalkIt: 'green',
          title: `Syncing Communication Data (1 / ${BLOCKCHAIN_TYPE.length})`
        })
        logger.hijackLogger(dynamicLogger)
      }
      await new Promise((r) => setTimeout(r, 500)) // Purposeful delay for updates to console

      let blockchainCount = 0
      for (let i = 0; i < BLOCKCHAIN_TYPE.length; i++) {
        await new Promise((r) => setTimeout(r, 500)) // Purposeful

        dynamicLogger.updateTitle({
          chalkIt: 'green',
          title: `Syncing Comm protocol data (${i + 1} / ${BLOCKCHAIN_TYPE.length})`
        })

        dynamicLogger.updateLogs(0, {
          chalkIt: `green`,
          title: 'Syncing Comm:',
          progress: i,
          total: BLOCKCHAIN_TYPE.length,
          append: `Current Blockchain: ${BLOCKCHAIN_TYPE[i]}`
        })

        const blockchain: string = BLOCKCHAIN_TYPE[i].toString()
        const verificationType: string = VERIFICATION_TYPE[i]
        logger.info('Fetching Protocol Blocks synced for %s ...', BLOCKCHAIN_TYPE[i])

        // // Do the sync
        const epnsComm: any = await this.getInteractableContract(
          blockchain,
          CONTRACT_TYPE[1],
          offset
        )
        logger.info(`Fetching Latest Block for ${blockchain}...`)

        await epnsComm.provider
          .getBlockNumber()
          .then(async (latestBlock) => {
            // Get Current Block
            logger.info('Latest ' + blockchain + ' Block is %d', latestBlock)
            logger.info(`Updating Sync Blocks for ${blockchain}...`)

            commResponse = await this.syncCommContractData(
              parseInt(protocolSyncBlocks[`${verificationType}_subscriber_block_number`]),
              parseInt(protocolSyncBlocks[`${verificationType}_payload_block_number`]),
              latestBlock,
              blockchain,
              epnsComm,
              verificationType
            )

            logger.info(`Syncing Logic Completed for ${blockchain}`)
          })
          .catch((err) => {
            logger.error(err)
            reject(err)
          })

        dynamicLogger.updateLogs(0, {
          chalkIt: `green`,
          title: 'Syncing Comm:',
          progress: i + 1,
          total: BLOCKCHAIN_TYPE.length,
          append: `Current Blockchain: ${BLOCKCHAIN_TYPE[i]}`
        })

        blockchainCount++
      }

      // Turn on normal logger
      dynamicLogger.updateFooterLogs(null)
      dynamicLogger.stopRendering()
      dynamicLogger.reset()
      logger.hijackLogger(null)
      logger.info('Comm Protocol Sync Completed ')

      // syncing completed
      logger.info('Entire Syncing Logic Completed')
      // await redisClient.set(config.syncStatus, 'true')
      resolve({ coreResponse, commResponse })
    })
  }

  /**
   * Fetches block timestamp by block number (via rpc)
   * @param epnsComm provider obj
   * @param blockNumberToTimestamp cache (clean this one often)
   * @param blockNumber blockNumber for lookup
   * @private block timestamp
   */
  private async fetchBlockTimestampWithCache(
    epnsComm: InterContract,
    blockNumberToTimestamp: Map<number, number>,
    blockNumber: number
  ): Promise<number | null> {
    if (blockNumber == null) {
      return null
    }
    const cached = blockNumberToTimestamp.get(blockNumber)
    if (cached != null) {
      return cached
    }
    const blockObj = await epnsComm.provider.getBlock(blockNumber)
    const blockTimestamp = blockObj.timestamp * 1000
    blockNumberToTimestamp.set(blockNumber, blockTimestamp)
    return blockTimestamp
  }
}
