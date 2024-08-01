import { ethers } from 'ethers'
import * as IPFS from 'nano-ipfs-store'
import { recoverTypedSignature_v4 as recoverTypedSignatureV4 } from 'eth-sig-util'
import config from '../config'
import { reject } from 'lodash'
import payloadHelper from './payloadHelper'
import { EventType } from '../enums/EventType'
const PAYLOAD_DELIMITER = '+'

export type InterContract = {
  provider: ethers.providers.JsonRpcProvider
  contract: ethers.Contract
  signingContract: ethers.Contract
}

module.exports = {
  // Get Interactable Contracts
  getInteractableContracts: async function (
    network,
    apiKeys,
    walletPK,
    deployedContract,
    deployedContractABI
  ): Promise<InterContract> {
    const showLogs = 0
    let provider
    switch (network) {
      case config.web3EthereumNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3EthereumProvider)
        // await ethers.getDefaultProvider(network, {
        //   etherscan: apiKeys.etherscanAPI ? apiKeys.etherscanAPI : null,
        //   infura: apiKeys.infuraAPI
        //     ? {
        //         projectId: apiKeys.infuraAPI.projectID,
        //         projectSecret: apiKeys.infuraAPI.projectSecret
        //       }
        //     : null,
        //   alchemy: apiKeys.alchemyAPI ? apiKeys.alchemyAPI : null,
        //   quicknode: new ethers.providers.JsonRpcProvider(config.web3EthereumProvider),
        //   quorum: 1
        // })
        break
      case config.web3PolygonNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3PolygonProvider)
        break
      case config.web3BscNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3BscProvider)
        break
      // case config.web3FvmNetwork:
      //   provider = new ethers.providers.JsonRpcProvider(
      //     config.web3FvmProvider
      //   );
      //   break;
      case config.web3ArbitrumNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3ArbitrumProvider)
        break

      case config.web3OptimismNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3OptimismProvider)
        break
      case config.web3PolygonZkEVMNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3PolygonZkEVMProvider)
        break
      case config.web3FuseNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3FuseProvider)
        break
      case config.web3BerachainNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3BerachainProvider)
        break
      case config.web3LineaNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3LineaProvider)
        break
      case config.web3BaseNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3BaseProvider)
        break
      case config.web3CyberConnectNetwork:
        provider = new ethers.providers.JsonRpcProvider(config.web3CyberConnectProvider)
        break
      default:
        return {
          provider: null,
          contract: null,
          signingContract: null
        }
    }

    const contract = new ethers.Contract(deployedContract, deployedContractABI, provider)

    let contractWithSigner = null

    if (walletPK) {
      const wallet = new ethers.Wallet(walletPK, provider)
      contractWithSigner = contract.connect(wallet)
    }

    return {
      provider: provider,
      contract: contract,
      signingContract: contractWithSigner
    }
  },
  // Interpret Channel Identity
  interpretChannelIdentity: function (channel, identityBytes) {
    // Identity is payloadtype+payloadhash
    // Convert identityBytes to identity first
    const identity = ethers.utils.toUtf8String(identityBytes)
    const ids = identity.split('+') // First segment is storage type, second is the pointer to it or equivalent
    const type = parseInt(ids[0])
    let success = 0
    let storageHash = null

    // Channel Type Base Logic
    if (type == 1) {
      // Only IPFS Channel is supported right now
      if (ids.length >= 2) {
        storageHash = ids[1]
        success = 1
      }
    }

    return {
      success: success,
      channel: channel,
      storageHash: storageHash,
      rawIdentity: identity
    }
  },
  // Interpret Notification Identity
  interpretNotificationIdentity: async function (channel, recipient, identityBytes) {
    return new Promise(async (resolve, reject) => {
      // Identity is payloadtype+payloadhash

      // Convert identityBytes to identity first
      let identity = ethers.utils.toUtf8String(identityBytes)
      const delimiter = '+'

      let type = parseInt(identity.substring(0, identity.indexOf(delimiter)))
      let payloadHash = identity.substring(identity.indexOf(delimiter) + 1)

      let success = 0
      let receiver = channel

      // Notification Type Base Logic
      // TYPE 0 | SPECIAL SMART CONTRACT PAYLOAD | REDEFINE TYPE
      if (type == 0) {
        // EXAMPLE PAYLOAD - bytes("0+1+<title>+<body>")
        type = parseInt(identity.substring(2, identity.indexOf(delimiter, 2)))
        const title = identity.substring(
          identity.indexOf(delimiter, 2) + 1,
          identity.indexOf(delimiter, 4)
        )
        const body = identity.substring(identity.indexOf(delimiter, 4) + 1)

        // Payload to be added to IPFS
        const payload = {
          notification: {
            title: title,
            body: body
          },
          data: {
            type: type,
            secret: '',
            asub: title,
            amsg: body,
            acta: '',
            aimg: ''
          }
        }

        //ADD PAYLOAD TO IPFS
        const ipfs = IPFS.at('https://ipfs.infura.io:5001')
        const cid = await ipfs.add(JSON.stringify(payload))

        //SET identity TO type + ipfsHash
        identity = type + '+' + cid
      }

      // TYPE 1 | STORAGE - IPFS | TYPE - BROADCAST
      if (type == 1) {
        payloadHash = identity.substring(identity.indexOf(delimiter) + 1)
        receiver = channel
        success = 1
      }

      // TYPE 2 | STORAGE - IPFS | TYPE - SECRET
      else if (type == 2) {
        payloadHash = identity.substring(identity.indexOf(delimiter) + 1)
        receiver = recipient
        success = 1
      }

      // TYPE 3 | STORAGE - IPFS | TYPE - TARGETTED
      else if (type == 3) {
        payloadHash = identity.substring(identity.indexOf(delimiter) + 1)
        receiver = recipient
        success = 1
      }

      // TYPE 4 | STORAGE - IPFS | TYPE - SUBSET
      else if (type == 4) {
        payloadHash = identity.substring(identity.indexOf(delimiter) + 1)
        receiver = channel
        success = 1
      }

      // TYPE 5 | STORAGE - IPFS | TYPE - TYPE 5 SECRET
      else if (type == 5) {
        payloadHash = identity.substring(identity.indexOf(delimiter) + 1)
        receiver = recipient
        success = 1
      }
      resolve({
        success: success,
        channel: channel,
        recipient: receiver,
        payloadType: type,
        payloadHash: payloadHash,
        rawIdentity: identity
      })
    })
  },
  interpretSubgraphIdentity: function (identity) {
    // Identity is pollTime+subgraphId
    const ids = identity.split('+') // First segment is poll time type, second is the pointer to it or equivalent
    const pollTime = parseInt(ids[0])
    const success = 0
    const subgraphId = ids[1]
    return {
      success: success,
      subgraphId: subgraphId,
      pollTime: pollTime
    }
  },

  // FETCHERS
  // GET CHANNELS
  getChannelsList: async function (contract, startBlock, endBlock, blockchain, showLogs) {
    return new Promise(async (resolve, reject) => {
      if (showLogs) console.log('Fetching Add and Update Events for Channels')
      const addedChannels = await this.getChannelAddEvents(contract, startBlock, endBlock)
      if (showLogs) console.log('Added Channels List: %o', addedChannels)

      const updatedChannels = await this.getChannelUpdateEvents(contract, startBlock, endBlock)
      if (showLogs) console.log('Updated Channels List: %o', updatedChannels)

      updatedChannels.forEach(function (item) {
        if (addedChannels[`${item.channel}`]) {
          addedChannels[`${item.channel}`].identity = item.identity
        }
      })

      if (showLogs) console.log('Full list of All Channels (added and updated): %o', addedChannels)

      resolve(addedChannels)
    }).catch((err) => {
      console.log('!!!Error, getChannelsList() --> %o', err)
      reject(err)
    })
  },
  // GET CHANNELS
  getSubscribersList: async function (
    contract: Contract,
    startBlock,
    endBlock,
    showLog
  ): Promise<void | SubscribersResult> {
    return await new Promise<SubscribersResult>(async (resolve, reject) => {
      if (showLog) console.log('Fetching Subscribe and Unsubscribe Events for Channels')

      const subscribeEvents: ChannelData = await this.getSubscribeEvents(
        contract,
        startBlock,
        endBlock,
        showLog
      )
      if (showLog) console.log('Subscribed Events List: %o', subscribeEvents)

      const unsubscribeEvents: ChannelData = await this.getUnsubscribeEvents(
        contract,
        startBlock,
        endBlock,
        showLog
      )
      if (showLog) console.log('Unsubscribed Events List: %o', unsubscribeEvents)

      resolve({ subscribeEvents, unsubscribeEvents })
    }).catch((err) => {
      console.log('!!!Error, getSubscribersList() --> %o', err)
      reject(err)
    })
  },
  // GET ADD CHANNELS
  getChannelAddEvents: async function (contract, startBlock, endBlock, showLogs) {
    return new Promise((resolve, reject) => {
      // To get channel ipfs hash from channel info
      const filter = contract.filters.AddChannel()
      let startBlockNum = startBlock
      if (!startBlockNum || startBlockNum == -1) startBlockNum = null

      let endBlockNum = endBlock
      if (!endBlockNum || endBlockNum == -1) endBlockNum = null

      contract
        .queryFilter(filter, startBlockNum, endBlockNum)
        .then((response) => {
          const filteredResponse = {}
          if (showLogs) console.log('getChannelAddEvents() --> %o', response)

          response.forEach(function (item) {
            if (showLogs)
              console.log('getChannelEvent() --> Selected Channel %o: ', item.args.channel)
            filteredResponse[`${item.args.channel}`] = {
              channel: item.args.channel,
              channelType: item.args.channelType,
              identity: item.args.identity
            }
          })

          if (showLogs) console.log('getChannelEvent() --> Filtered Channel: %o', filteredResponse)
          resolve(filteredResponse)
        })
        .catch((err) => {
          console.log('!!!Error, getChannelEvent() --> %o', err)
          reject(err)
        })
    })
  },
  // GET UPDATED CHANNELS
  getChannelUpdateEvents: async function (contract, startBlock, endBlock, showLogs) {
    return new Promise((resolve, reject) => {
      // To get channel ipfs hash from channel info
      const filter = contract.filters.UpdateChannel()
      let startBlockNum = startBlock
      if (!startBlockNum || startBlockNum == -1) startBlockNum = null

      let endBlockNum = endBlock
      if (!endBlockNum || endBlockNum == -1) endBlockNum = null

      contract
        .queryFilter(filter, startBlockNum, endBlockNum)
        .then((response) => {
          const filteredResponse = []
          if (showLogs) console.log('getChannelUpdateEvents() --> %o', response)

          response.forEach(function (item) {
            if (showLogs)
              console.log('getChannelUpdateEvents() --> Selected Channel %o: ', item.args.channel)
            filteredResponse.push({
              channel: item.args.channel,
              identity: item.args.identity
            })
          })

          if (showLogs)
            console.log('getChannelUpdateEvents() --> Filtered Channel: %o', filteredResponse)
          resolve(filteredResponse)
        })
        .catch((err) => {
          console.log('!!!Error, getChannelUpdateEvents() --> %o', err)
          reject(err)
        })
    })
  },

  // GET SUBSCRIBE EVENTS
  getSubscribeEvents: async function (
    contract: Contract,
    startBlock: number,
    endBlock: number,
    showLogs: boolean
  ): Promise<ChannelData> {
    return new Promise((resolve, reject) => {
      // To get channel ipfs hash from channel info
      const filter = contract.filters.Subscribe()
      let startBlockNum = startBlock
      if (!startBlockNum || startBlockNum == -1) startBlockNum = null

      let endBlockNum = endBlock
      if (!endBlockNum || endBlockNum == -1) endBlockNum = null

      contract
        .queryFilter(filter, startBlockNum, endBlockNum)
        .then((eventArr) => {
          const convertedArr = convertSubUnsubEvents(eventArr, 'getSubscribeEvents', showLogs)
          resolve(convertedArr)
        })
        .catch((err) => {
          console.log('!!!Error, getSubscribeEvents() --> %o', err)
          reject(err)
        })
    })
  },
  // GET UNSUBSCRIBE EVENTS
  getUnsubscribeEvents: async function (
    contract: Contract,
    startBlock,
    endBlock,
    showLogs
  ): Promise<ChannelData> {
    return new Promise((resolve, reject) => {
      // To get channel ipfs hash from channel info
      const filter = contract.filters.Unsubscribe()
      let startBlockNum = startBlock
      if (!startBlockNum || startBlockNum == -1) startBlockNum = null

      let endBlockNum = endBlock
      if (!endBlockNum || endBlockNum == -1) endBlockNum = null

      contract
        .queryFilter(filter, startBlockNum, endBlockNum)
        .then((eventArr) => {
          const convertedArr = convertSubUnsubEvents(eventArr, 'getUnsubscribeEvents', showLogs)
          resolve(convertedArr)
        })
        .catch((err) => {
          console.log('!!!Error, getUnsubscribeEvents() --> %o', err)
          reject(err)
        })
    })
  },

  // GET NOTIFICATIONS
  getNotificationsList: async function (contract, startBlock, endBlock, showLogs) {
    return new Promise(async (resolve, reject) => {
      if (showLogs) console.log('Fetching SendNotification Events for Channels')
      const sentNotifications = await this.getSendNotificationEvents(
        contract,
        startBlock,
        endBlock,
        showLogs
      )
      if (showLogs) console.log('Sent Notifications List: %o', sentNotifications)
      if (showLogs) console.log(sentNotifications)

      if (showLogs) console.log('Full list of All Sent Notifications: %o', sentNotifications)

      resolve(sentNotifications)
    }).catch((err) => {
      console.log('!!!Error, getNotificationsList() --> %o', err)
      reject(err)
    })
  },
  // helper function to get appropriate NPIP block number
  getNIPIPBlockNumber: function (chainId) {
    switch (chainId) {
      case config.ethereumChainId:
        return config.NPIPImplemenationBlockEth
      case config.polygonChainId:
        return config.NPIPImplemenationBlockPolygon
      case config.bscChainId:
        return config.NPIPImplemenationBlockBsc
      // case config.fvmChainId:
      //   return config.NPIPImplemenationBlockFvm
      case config.arbitrumChainId:
        return config.NPIPImplemenationBlockArbitrum
      case config.optimismChainId:
        return config.NPIPImplemenationBlockOptimism
      case config.polygonZkEVMChainId:
        return config.NPIPImplemenationBlockPolygonZkEVM
      default:
        return null
    }
  },
  // helper function to convert unsupported type before NIPIP to NIPIP compatible
  getIdentityInNIPIPFormat: function (identity) {
    const NIPIPIdentity = `1+${identity.split(PAYLOAD_DELIMITER)[1]}`
    return NIPIPIdentity
  },
  getSendNotificationEvents: async function (contract, startBlock, endBlock, showLogs) {
    return new Promise((resolve, reject) => {
      // get the chain id from the contract instance
      const self = this
      // Fetch the NIPIP Block based on chainId
      const chainId = contract.provider._network.chainId
      const NIPIP_BLOCK_NUMBER = this.getNIPIPBlockNumber(chainId)

      const filter = contract.filters.SendNotification()
      let startBlockNum = startBlock
      if (!startBlockNum || startBlockNum == -1) startBlockNum = null

      let endBlockNum = endBlock
      if (!endBlockNum || endBlockNum == -1) endBlockNum = null

      contract
        .queryFilter(filter, startBlockNum, endBlockNum)
        .then((response) => {
          const filteredResponse = {}
          if (showLogs) console.log('getSendNotificationEvents() --> %o', response)
          response.forEach(function (item) {
            // convert bytes to string
            let identity = payloadHelper.convertBytesToString(item.args.identity)
            // If data in a block is less then the BIPIP Block then convert  it
            if (item.blockNumber < NIPIP_BLOCK_NUMBER)
              identity = self.getIdentityInNIPIPFormat(identity)

            if (showLogs)
              console.log('SendNotification() --> Selected Channel %o: ', item.args.channel)
            filteredResponse[`${item.transactionHash}`] = {
              trxHash: item.transactionHash,
              channel: item.args.channel,
              recipient: item.args.recipient,
              identity: identity
            }
          })

          if (showLogs)
            console.log('getSendNotificationEvents() --> Filtered Channel: %o', filteredResponse)
          resolve(filteredResponse)
        })
        .catch((err) => {
          console.log('!!!Error, getSendNotificationEvents() --> %o', err)
          reject(err)
        })
    })
  },
  getChannelAliasEvents: async function (contract, startBlock, endBlock, showLogs) {
    return new Promise(async (resolve, reject) => {
      // To get channel ipfs hash from channel info
      const filter = contract.filters.ChannelAlias()
      let startBlockNum = startBlock
      if (!startBlockNum || startBlockNum == -1) startBlockNum = null

      let endBlockNum = endBlock
      if (!endBlockNum || endBlockNum == -1) endBlockNum = null
      // console.log(contract)

      contract
        .queryFilter(filter, startBlockNum, endBlockNum)
        .then((response) => {
          const filteredResponse = {}
          if (showLogs) console.log('getChannelAliasEvents() --> %o', response)
          // const items = []
          response.forEach((element) => {
            filteredResponse[element.args._channelOwnerAddress] = element
          })
          if (showLogs)
            console.log('getChannelAliasEvents() --> Filtered Channel: %o', filteredResponse)
          resolve(filteredResponse)
        })
        .catch((err) => {
          console.log('!!!Error, getChannelAliasEvents() --> %o', err)
          reject(err)
        })
    })
  },
  getChannelAliasList: async function (contract, startBlock, endBlock, showLogs) {
    return new Promise(async (resolve, reject) => {
      if (showLogs) console.log('Fetching ChannelAliasList Events for Channels')

      const channelAlias = await this.getChannelAliasEvents(
        contract,
        startBlock,
        endBlock,
        showLogs
      )
      if (showLogs) console.log('Channel Alias List: %o', channelAlias)
      if (showLogs) console.log(channelAlias)

      if (showLogs) console.log('Full list of Channel Alias: %o', channelAlias)

      resolve(channelAlias)
    }).catch((err) => {
      console.log('!!!Error, getNotificationsList() --> %o', err)
      reject(err)
    })
  },

  getRemoveChannelAliasEvents: async function (contract, startBlock, endBlock, showLogs) {
    return new Promise(async (resolve, reject) => {
      const filter = contract.filters.RemoveChannelAlias()
      let startBlockNum = startBlock
      if (!startBlockNum || startBlockNum == -1) startBlockNum = null

      let endBlockNum = endBlock
      if (!endBlockNum || endBlockNum == -1) endBlockNum = null
      // console.log(contract)

      contract
        .queryFilter(filter, startBlockNum, endBlockNum)
        .then((response) => {
          const filteredResponse = {}
          if (showLogs) console.log('getRemoveChannelAliasEvents() --> %o', response)
          // const items = []
          response.forEach((element) => {
            filteredResponse[element.transactionHash] = element.args
          })
          if (showLogs)
            console.log('getRemoveChannelAliasEvents() --> Filtered Channel: %o', filteredResponse)
          resolve(filteredResponse)
        })
        .catch((err) => {
          console.log('!!!Error, getRemoveChannelAliasEvents() --> %o', err)
          reject(err)
        })
    })
  },
  getRemoveChannelAliasList: async function (contract, startBlock, endBlock, showLogs) {
    return new Promise(async (resolve, reject) => {
      if (showLogs) console.log('Fetching RemoveChannelAliasList Events for Channels')

      const removeChannelAlias = await this.getRemoveChannelAliasEvents(
        contract,
        startBlock,
        endBlock,
        showLogs
      )
      if (showLogs) console.log('Remove Channel Alias List: %o', removeChannelAlias)
      if (showLogs) console.log(removeChannelAlias)

      if (showLogs) console.log('Full list of Channel Alias: %o', removeChannelAlias)

      resolve(removeChannelAlias)
    }).catch((err) => {
      console.log('!!!Error, getRemoveChannelAliasList() --> %o', err)
      reject(err)
    })
  },

  getUserSettingEvents: async function (contract, startBlock, endBlock, showLogs) {
    return new Promise(async (resolve, reject) => {
      // To get channel ipfs hash from channel info
      const filter = contract.filters.UserNotifcationSettingsAdded()
      let startBlockNum = startBlock
      if (!startBlockNum || startBlockNum == -1) startBlockNum = null

      let endBlockNum = endBlock
      if (!endBlockNum || endBlockNum == -1) endBlockNum = null
      // console.log(contract)

      contract
        .queryFilter(filter, startBlockNum, endBlockNum)
        .then((response) => {
          if (showLogs) console.log('UserNotifcationSettingsAdded() --> %o', response)
          const items = []
          response.map(function (item) {
            if (showLogs)
              console.log(
                'UserNotifcationSettingsAdded() --> Selected Channel %o: ',
                item.args._channel
              )
            items.push(item.args)
          })
          const filteredResponse = items.reduce((initial, item) => {
            if (initial[`${item._channel}`] && initial[`${item.channel}`]._user) {
              initial[`${item.channel}`].users.push(`${item.args}`)
            } else {
              initial[`${item._channel}`] = { users: [`${item.args}`] }
            }
            return initial
          }, {})

          if (showLogs) console.log('unsub events: %o', filteredResponse)

          if (showLogs)
            console.log('getUnsubscribeEvents() --> Filtered Channel: %o', filteredResponse)
          resolve(filteredResponse)
        })
        .catch((err) => {
          console.log('!!!Error, getUnsubscribeEvents() --> %o', err)
          reject(err)
        })
    })
  },
  getUserSettingList: async function (contract, startBlock, endBlock, showLogs) {
    return new Promise(async (resolve, reject) => {
      if (showLogs) console.log('Fetching ChannelAliasList Events for Channels')

      const userSetting = await this.getUserSettingEvents(contract, startBlock, endBlock, showLogs)
      if (showLogs) console.log('Channel Alias List: %o', userSetting)
      if (showLogs) console.log(userSetting)

      if (showLogs) console.log('Full list of Channel Alias: %o', userSetting)

      resolve(userSetting)
    }).catch((err) => {
      console.log('!!!Error, getNotificationsList() --> %o', err)
      reject(err)
    })
  },
  getContractEvents: async function (
    contract,
    eventType: EventType,
    startBlock,
    endBlock,
    showLogs
  ) {
    return new Promise(async (resolve, reject) => {
      // To get channel ipfs hash from channel info
      const filter = await this.deriveContractFilter(contract, eventType)
      let startBlockNum = startBlock
      if (!startBlockNum || startBlockNum == -1) startBlockNum = null

      let endBlockNum = endBlock
      if (!endBlockNum || endBlockNum == -1) endBlockNum = null
      // console.log(contract)

      contract
        .queryFilter(filter, startBlockNum, endBlockNum)
        .then((response) => {
          const filteredResponse = {}
          if (showLogs) console.log('get %o events --> %o', eventType, response)
          // const items = []
          response.forEach((element) => {
            filteredResponse[element.transactionHash] = element.args
          })
          if (showLogs)
            console.log('get %o events --> Filtered Channel: %o', eventType, filteredResponse)
          resolve(filteredResponse)
        })
        .catch((err) => {
          console.log('!!!Error, get %o events --> %o', eventType, err)
          reject(err)
        })
    })
  },
  getContractEventsList: async function (
    contract,
    eventType: EventType,
    startBlock,
    endBlock,
    showLogs
  ) {
    return new Promise(async (resolve, reject) => {
      if (showLogs) console.log('Fetching %o list events for Channels', eventType)

      const events = await this.getContractEvents(
        contract,
        eventType,
        startBlock,
        endBlock,
        showLogs
      )
      if (showLogs) console.log('%o List: %o', eventType, events)
      if (showLogs) console.log(events)
      if (showLogs) console.log('Full list of %o events : %o', eventType, events)

      resolve(events)
    }).catch((err) => {
      console.log('!!!Error, get %o events --> %o', eventType, err)
      reject(err)
    })
  },
  // HELPER FUNCTION
  // Return Address Without Padding
  addressWithoutPadding: function (paddedAddress) {
    return paddedAddress.replace('0x000000000000000000000000', '0x')
  },
  //Offchain helper functions
  //Verify if the signer is authentic or not
  verifySignedMessage: function (
    message,
    signature,
    walletAddress,
    deployedContract,
    chainId,
    delegatee
  ) {
    return new Promise((resolve, reject) => {
      // Can be used when ethers is updated to 5.4.8
      // const recoveredAddress = ethers.utils.verifyTypedData(domain,type,message,signature);
      try {
        //Format the data to recover
        const domain = {
          name: 'EPNS COMM V1',
          chainId: chainId,
          verifyingContract: deployedContract
        }
        const typedData = {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' }
            ],
            Payload: [
              { name: 'notification', type: 'Notification' },
              { name: 'data', type: 'Data' }
            ],
            Notification: [
              { name: 'title', type: 'string' },
              { name: 'body', type: 'string' }
            ],
            Data: [
              { name: 'acta', type: 'string' },
              { name: 'aimg', type: 'string' },
              { name: 'amsg', type: 'string' },
              { name: 'asub', type: 'string' },
              { name: 'type', type: 'string' },
              { name: 'secret', type: 'string' }
            ]
          },
          domain: domain,
          primaryType: 'Payload',
          message: message
        }
        //Fetch the recovered address
        const recoveredAddress = recoverTypedSignatureV4({
          data: typedData,
          sig: signature
        })
        console.log(recoveredAddress)
        //Check if the recovered address is same as the signed address
        if (
          recoveredAddress.toLowerCase() === walletAddress.toLowerCase() ||
          (delegatee && delegatee.includes(recoveredAddress.toLowerCase()))
        ) {
          console.log('Correct Signer')
          resolve(true)
        } else {
          console.log('Incorrect Signer')
          resolve(false)
        }
      } catch (error) {
        console.log('!!!Error: An error occured whie verifying signature')
        reject(error)
      }
    })
  },
  deriveContractFilter: async function (contract: any, eventType: EventType) {
    switch (eventType) {
      case EventType.ChannelVerified: {
        return await contract.filters.ChannelVerified()
      }
      case EventType.ChannelVerificationRevoked: {
        return await contract.filters.ChannelVerificationRevoked()
      }
      case EventType.ChannelBlocked: {
        return await contract.filters.ChannelBlocked()
      }
      case EventType.RemoveDelegate: {
        return await contract.filters.RemoveDelegate()
      }
      case EventType.AddDelegate: {
        return await contract.filters.AddDelegate()
      }
      case EventType.ReactivateChannel: {
        return await contract.filters.ReactivateChannel()
      }
      case EventType.DeactivateChannel: {
        return await contract.filters.DeactivateChannel()
      }
      case EventType.AddSubGraph: {
        return await contract.filters.AddSubGraph()
      }
      case EventType.TimeBoundChannelDestroyed: {
        return await contract.filters.TimeBoundChannelDestroyed()
      }
      case EventType.ChannelNotifcationSettingsAdded: {
        return await contract.filters.ChannelNotifcationSettingsAdded()
      }
      default: {
        break
      }
    }
  }
}

export type SubscribersResult = { subscribeEvents: ChannelData; unsubscribeEvents: ChannelData }

export type ChannelData = {
  [channelName: string]: { users: string[] } // 'channel:signature:blockNumber'[]
}

type SubEvent = { channel: string; user: string; transactionHash: string; blockNumber: number }

function convertSubUnsubEvents(
  eventArr: ethers.Event[],
  logPrefix: string,
  showLogs: boolean
): ChannelData {
  if (showLogs) {
    console.log('%s --> %o', logPrefix, eventArr)
  }
  const chData: ChannelData = {}
  for (const event of eventArr) {
    if (showLogs) {
      console.log(' --> Selected Channel %o: ', logPrefix, event.args.channel)
    }
    const channel = event.args['channel']
    const user = event.args['user']
    const blockNumber = event.blockNumber
    const transactionHash = event.transactionHash

    let channelProp = chData[`${channel}`]
    if (!(channelProp && channelProp.users)) {
      channelProp = { users: [] }
      chData[`${channel}`] = channelProp
    }
    const userPacked = `${user}:${transactionHash}:${blockNumber}`
    channelProp.users.push(userPacked)
  }
  if (showLogs) {
    console.log(' --> Filtered Channel: %o', logPrefix, chData)
  }
  return chData
}
