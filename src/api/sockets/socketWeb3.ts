import { Container } from 'typedi'
import Web3 from 'web3'
import { Logger } from 'winston'

import config from '../../config'
import { getChannelAddressfromEthAddress } from '../../helpers/caipHelper'
import * as channelAndAliasHelper from '../../helpers/channelAndAliasHelper'
import * as epnsAPIHelper from '../../helpers/epnsAPIHelper'
import * as payloadHelper from '../../helpers/payloadHelper'
import Alias from '../../services/channelsCompositeClasses/aliasClass'
import Channel from '../../services/channelsCompositeClasses/channelsClass'
import ChannelsService from '../../services/channelsService'
import PayloadsService from '../../services/payloadsService'
import StrUtil from "../../utilz/strUtil";
import {Check} from "../../utilz/check";

const CONTRACT_TYPE: Array<string> = ['Core', 'Comm']
const BLOCKCHAIN_TYPE: Array<string> = config.supportedCAIP

const SOCKET_TYPE: Array<string> = config.SOCKET_ARRAY

const COMM_CONTRACT_ADDRESS: Array<string> = config.COMM_CONTRACT_ARRAY

const CAIP_TYPE: Array<string> = config.supportedCAIP

const VERIFICATION_PROOF_DELIMITER = ':'

const options = {
  timeout: 30000, // ms

  clientConfig: {
    // Useful if requests are large
    maxReceivedFrameSize: 100000000, // bytes - default: 1MiB
    maxReceivedMessageSize: 100000000,

    // Useful to keep a connection alive
    keepalive: true,
    keepaliveInterval: -1 // ms
  },

  // Enable auto reconnection
  reconnect: {
    auto: true,
    delay: 1000, // ms
    maxAttempts: 100,
    onTimeout: false
  }
}
export default async () => {
  const MIN_TIMEOUT = 10 * 1000 // 10 secs
  const MAX_TIMEOUT = 90 * 60 * 1000 // 90 mins
  const MULTIPLIER = 2
  let timeoutValue = MIN_TIMEOUT / 2
  let connectionQueued = false

  // try reconnecting to socket
  const listenToWeb3SocketAfterError = () => {
    const Logger: Logger = Container.get('logger')

    if (connectionQueued == true) {
      Logger.info('Connection to Web3 Socket already queued, returning...')
      return
    }
    connectionQueued = true

    timeoutValue = timeoutValue * MULTIPLIER
    if (timeoutValue > MAX_TIMEOUT) {
      timeoutValue = MAX_TIMEOUT
    }
    Logger.info('💈Reconnecting to Web3 Socket after Timeout: %d secs', timeoutValue / 1000)
    setTimeout(listenToWeb3Socket, timeoutValue)
  }

  // Initialize web3
  const listenToWeb3Socket = () => {
    const Logger: Logger = Container.get('logger')
    Logger.info('Loading Web3 Socket and Listener')

    connectionQueued = false // reset connection queued

    Check.notNull(config.web3EthereumSocket, 'provider (ETH) host is missing');
    //Listen to Core protocol events
    const ethereumProvider = new Web3.providers.WebsocketProvider(
      config.web3EthereumSocket,
      options
    )

    try {
      ethereumProvider.on('error', (e) => {
        try {
          Logger.error('Web socket errorred : %o', e)
          ethereumProvider.disconnect()
          listenToWeb3SocketAfterError()
        } catch (error) {
          console.log(error)
        }
      })

      ethereumProvider.on('end', (e) => {
        try {
          Logger.error('Web socket ended connection : %o', e)
          listenToWeb3SocketAfterError()
        } catch (error) {
          console.log(error)
        }
      })
    } catch (err) {
      Logger.error(err)
    }

    const ethereumWeb3 = new Web3(ethereumProvider)
    const ethereumEpnsCoreContract = new ethereumWeb3.eth.Contract(
      config.deployedCoreContractABI,
      config.deployedCoreContract
    )
    listenToEvents(
      ethereumEpnsCoreContract,
      ethereumProvider,
      BLOCKCHAIN_TYPE[0],
      CAIP_TYPE[0],
      CONTRACT_TYPE[0]
    )

    //Listen to Comm protocol events
    for (let i = 0; i < SOCKET_TYPE.length; i++) {

      // TODO TEMP CODE TO FIX CONFIG BUGS
      let provider;
      let providerHostUrl = SOCKET_TYPE[i];
      if(StrUtil.isEmpty(providerHostUrl)) {
        console.error(`ERROR: empty provider #${i} at ${providerHostUrl} (IGNORING!)`);
        continue;
      }
      try {
        provider = new Web3.providers.WebsocketProvider(providerHostUrl, options)
      } catch (e) {
        console.error(`ERROR: cannot connect to provider #${i} at ${providerHostUrl} (IGNORING!)`);
        continue;
      }
      Check.notNull(provider, 'provider is null');
      Check.notNull(providerHostUrl, 'provider host is missing');
      // END - TEMP CODE TO FIX CONFIG BUGS

      try {
        provider.on('error', (e) => {
          try {
            Logger.error('Web socket errorred : %o', e)
            provider.disconnect()
            listenToWeb3SocketAfterError()
          } catch (error) {
            console.log(error)
          }
        })

        provider.on('end', (e) => {
          try {
            Logger.error('Web socket ended connection : %o', e)
            listenToWeb3SocketAfterError()
          } catch (error) {
            console.log(error)
          }
        })
      } catch (err) {
        Logger.error(err)
      }

      const providerWeb3 = new Web3(provider)

      const commContract = new providerWeb3.eth.Contract(
        config.deployedCommunicatorContractABI,
        COMM_CONTRACT_ADDRESS[i]
      )

      listenToEvents(commContract, provider, BLOCKCHAIN_TYPE[i], CAIP_TYPE[i], CONTRACT_TYPE[1])
    }
    Logger.info('Web3 Listeners loaded!')
  }

  const resetTimeoutValue = () => {
    timeoutValue = MIN_TIMEOUT / 2
  }

  // Web3 Listener
  const listenToEvents = (
    epnsContract,
    blockchainProvider,
    network: string,
    caipType: string,
    contractType: string
  ) => {
    const Logger: Logger = Container.get('logger')


    if (contractType == CONTRACT_TYPE[0]) {
      Logger.info(`Listening on Blockchain for Emit -- AddChannel(channel, channelType, identity)`);

      // ADD CHANNEL EVENT
      epnsContract.events.AddChannel(async (error, event) => {
        const eventName = 'Add Channel'

        if (error) {
          Logger.error('Web3 Event %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Event %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Data verification, skip for now

        // Now call the add channel
        const channels = Container.get(Channel)

        try {
          const response = await channels.addChannel(
            `${caipType}:${event.returnValues.channel}`,
            event.returnValues.channelType,
            event.returnValues.identity
          )
          Logger.info('Event Response %o', response)
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }
      })

      Logger.info(
        `Listening on Blockchain for Emit -- DeactivateChannel(channel, totalRefundableAmount)`
      )
      epnsContract.events.DeactivateChannel(async (error, event) => {
        const eventName = 'DeactivateChannel Channel'

        if (error) {
          Logger.error('Web3 Event %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Event %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Data verification, skip for now

        // Now call the add channel
        try {
          const channels = Container.get(Channel)
          await channels.setChannelActivationStatus(`${caipType}:${event.returnValues.channel}`, 0)

          Logger.info(
            'Completed ' +
              eventName +
              ' with or without error for channel ' +
              event.returnValues.channel
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }
      })

      Logger.info(`Listening on Blockchain for Emit -- ReactivateChannel(channel, amountDeposited)`)
      epnsContract.events.ReactivateChannel(async (error, event) => {
        const eventName = 'ReactivateChannel Channel'

        if (error) {
          Logger.error('Web3 Event %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Event %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Data verification, skip for now

        // Now call the add channel
        try {
          const channels = Container.get(Channel)
          await channels.setChannelActivationStatus(`${caipType}:${event.returnValues.channel}`, 1)

          Logger.info(
            'Completed ' +
              eventName +
              ' with or without error for channel ' +
              event.returnValues.channel
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }
      })

      // // UPDATE CHANNEL EVENT

      Logger.info(`Listening on Blockchain for Emit -- UpdateChannel(channel, identity)`)
      epnsContract.events.UpdateChannel(async (error, event) => {
        const eventName = 'Update Channel'
        if (error) {
          Logger.error('Web3 Event -- %s errored before start: %o', eventName, error)

          // disconnect provider and reconnect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Web3 Event -- %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Data verification, skip for now

        try {
          // Now call the add channel
          const channels = Container.get(Channel)
          await channels.updateChannel(
            `${caipType}:${event.returnValues.channel}`,
            event.returnValues.identity
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }

        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })
      //Block Channel

      Logger.info(`Listening on Blockchain for Emit-- ChannelBlocked(_channelAddress);`)
      epnsContract.events.ChannelBlocked(async (error, event) => {
        const eventName = 'Block Channel'

        if (error) {
          Logger.error('Web3 Event -- %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Web3 Event -- %s Detected: %o', eventName, event)
        Logger.debug('Blocking and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Data verification, skip for now

        // Now call the add channel
        try {
          const channels = Container.get(Channel)
          await channels.setChannelBlockedStatus(`${caipType}:${event.returnValues.channel}`, 1)
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }
        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })

      // Channel verififcation
      Logger.info(`Listening on Blockchain for Emit -- ChannelVerified(channel, verifier)`)
      epnsContract.events.ChannelVerified(async (error, event) => {
        const eventName = 'Verify Channel'

        if (error) {
          Logger.error('Web3 Event -- %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Web3 Event -- %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Data verification, skip for now

        // Now call the add channel
        try {
          const channels = Container.get(Channel)
          await channels.verifyChannel(`${caipType}:${event.returnValues.channel}`)
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }
        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })

      // Channel unverififcation
      Logger.info(`Listening on Blockchain for Emit -- ChannelUnverified(channel, verifier)`)
      epnsContract.events.ChannelVerificationRevoked(async (error, event) => {
        const eventName = 'Unverify Channel'

        if (error) {
          Logger.error('Web3 Event -- %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Web3 Event -- %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Data verification, skip for now

        // Now call the add channel
        try {
          const channels = Container.get(Channel)
          await channels.unVerifyChannel(`${caipType}:${event.returnValues.channel}`)
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }
        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })

      if (config.pushNodesNet !== 'PROD') {
        Logger.info(
          `Listening on Blockchain for Emit -- AddSubGraph(channel, subGraphId, pollTime)`
        )
        epnsContract.events.AddSubGraph(async (error, event) => {
          const Logger: Logger = Container.get('logger')
          const eventName = 'Add SubGraph'

          if (error) {
            Logger.error('Web3 Event %s errored before start: %o', eventName, error)

            // disconnect provider and recoonect
            blockchainProvider.disconnect()
            listenToWeb3SocketAfterError()

            return false
          }

          Logger.info('Event %s Detected: %o', eventName, event)
          Logger.debug('Verifying and Taking Appropriate Action...')

          // Reset timeout as well
          resetTimeoutValue()

          // Data verification, skip for now

          // Now call the add channel
          try {
            const channels = Container.get(Channel)
            const response = await channels.addSubGraphDetails(
              `${caipType}:${event.returnValues.channel}`,
              event.returnValues._subGraphData
            )

            Logger.info('Event Response %o', response)
          } catch (err) {
            Logger.error('Event %s skipped : %o', eventName, err)
          }
        })
      }

      // Time Bound Channel destruction
      Logger.info(
        `Listening on Blockchain for Emit -- TimeBoundChannelDestroyed(channel, amountRefunded)`
      )
      epnsContract.events.TimeBoundChannelDestroyed(async (error, event) => {
        const eventName = 'Time Bound Channel Destoryed'

        if (error) {
          Logger.error('Web3 Event -- %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Web3 Event -- %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Data verification, skip for now

        // Now call the add channel
        try {
          const channels = Container.get(Channel)
          await channels.destoryTimeBoundChannel(`${caipType}:${event.returnValues.channel}`)
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }
        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })

      // Channel setting
      Logger.info(
        `Listening on Blockchain for Emit -- ChannelNotifcationSettingsAdded(_channel, totalNotifOptions, _notifSettings, _notifDescription)`
      )
      epnsContract.events.ChannelNotifcationSettingsAdded(async (error, event) => {
        const eventName = 'ChannelNotifcationSettingsAdded'

        if (error) {
          Logger.error('Web3 Event -- %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Web3 Event -- %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Now call the update channel setting
        try {
          const channels = Container.get(Channel)
          await channels.addChannelSettings(
            `${caipType}:${event.returnValues._channel}`,
            event.returnValues._notifSettings,
            event.returnValues._notifDescription
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }
        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })
    }

    if (contractType == CONTRACT_TYPE[1]) {
      // SUBSCRIBE CHANNEL EVENT
      Logger.info(`Listening on Blockchain for Emit -- Subscribe(channel, user)`)
      epnsContract.events.Subscribe(async (error, event) => {
        const eventName = 'Subscribe to Channel'

        if (error) {
          Logger.error('Web3 Event -- %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Web3 Event -- %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Data verification, skip for now

        // Now call the add channel
        try {
          const channels = Container.get(ChannelsService)
          await channels.addExternalSubscribers(
            `${caipType}:${event.transactionHash}`,
            {
              channel: (epnsAPIHelper as any).addressWithoutPadding(event.raw.topics[1]),
              subscriber: (epnsAPIHelper as any).addressWithoutPadding(event.raw.topics[2])
            },
            config.MAP_BLOCKCHAIN_TO_ID[network],
            'eip155',
            'onchain'
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }

        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })

      // UNSUBSCRIBE CHANNEL EVENT
      Logger.info(`Listening on Blockchain for Emit -- Unsubscribe(channel, user)`)
      epnsContract.events.Unsubscribe(async (error, event) => {
        const eventName = 'Unsubscribe from Channel'

        if (error) {
          Logger.error('Web3 Event -- %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }

        Logger.info('Web3 Event -- %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        // Data verification, skip for now
        try {
          // Now call the add channel
          const channels = Container.get(ChannelsService)
          await channels.removeExternalSubscribers(
            `${caipType}:${event.transactionHash}`,
            {
              channel: (epnsAPIHelper as any).addressWithoutPadding(event.raw.topics[1]),
              unsubscriber: (epnsAPIHelper as any).addressWithoutPadding(event.raw.topics[2])
            },
            config.MAP_BLOCKCHAIN_TO_ID[network],
            'eip155'
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }
        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })

      // SEND MESSAGE EVENT
      Logger.info(
        `Listening on Blockchain for Emit -- SendNotification(channel, recipient, identity)`
      )
      epnsContract.events.SendNotification(async (error, event) => {
        const eventName = 'Send Message (Add Payload)'

        if (error) {
          Logger.error('Web3 Event -- %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }
        // Reset timeout as well
        resetTimeoutValue()

        Logger.info('Web3 Event %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action... ')

        // Data verification, skip for now

        // Now call the add channel
        try {
          const payloads = Container.get(PayloadsService)
          const identity = (payloadHelper as any).convertBytesToString(event.returnValues.identity)

          const result = await payloads.addExternalPayload(
            caipType + VERIFICATION_PROOF_DELIMITER + event.transactionHash,
            `${caipType}:${event.returnValues.channel}`,
            config.senderType.channel,
            `eip155:${event.returnValues.recipient}`,
            config.MAP_CAIP_TO_BLOCKCHAIN_STRING[network],
            identity
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }

        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)

        // Reset timeout as well
        resetTimeoutValue()
      })

      // ALIAS EVENT
      Logger.info(
        `Listening on Blockchain for Emit -- ChannelAlias(_chainName, _chainID, _channelOwnerAddress,_ethereumChannelAddress)`
      )
      epnsContract.events.ChannelAlias(async (error, event) => {
        const eventName = 'Channel Alias'
        if (error) {
          Logger.error('Web3 Event %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }
        Logger.info('Event %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        try {
          const alias = Container.get(Alias)
          await channelAndAliasHelper.ingestChannelAliasAddress(
            alias,
            caipType,
            event.returnValues._channelOwnerAddress,
            event.returnValues._ethereumChannelAddress,
            `${caipType}:${event.transactionHash}`
          )

          //Call checkAndUpdateAlias of Channel Service
          await alias.checkAndUpdateAlias(
            getChannelAddressfromEthAddress(event.returnValues._ethereumChannelAddress),
            `${caipType}:${event.returnValues._channelOwnerAddress}`,
            event.returnValues._chainID,
            `${caipType}:${event.transactionHash}`
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }

        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })

      //REMOVE ALIAS EVENT
      Logger.info(
        `Listening on Blockchain for Emit -- RemoveChannelAlias(_chainName, _chainID, _channelOwnerAddress, _baseChannelAddress)`
      )
      epnsContract.events.RemoveChannelAlias(async (error, event) => {
        const eventName = 'Remove Channel Alias'
        if (error) {
          Logger.error('Web3 Event %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }
        Logger.info('Event %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()
        try {
          const alias = Container.get(Alias)
          await alias.removeChannelAlias(
            `${caipType}:${event.returnValues._channelOwnerAddress}`,
            event.returnValues._baseChannelAddress
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }

        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })

      //Add Delegate Event
      Logger.info(
        `Listening on Blockchain for Emit -- AddDelegate(address channel, address delegate)`
      )
      epnsContract.events.AddDelegate(async (error, event) => {
        const eventName = 'Add Delegate'
        if (error) {
          Logger.error('Web3 Event %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }
        Logger.info('Event %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()
        try {
          //Call checkAndUpdateAlias of Channel Service
          const channels = Container.get(Channel)
          const res = await channels.setDelegateeAddress(
            `${caipType}:${event.returnValues.channel}`,
            `${caipType}:${event.returnValues.delegate}`
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }

        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })

      //Remove Delegate Event
      Logger.info(
        `Listening on Blockchain for Emit -- RemoveDelegate(address channel, address delegate)`
      )
      epnsContract.events.RemoveDelegate(async (error, event) => {
        const eventName = 'Remove Delegate'
        if (error) {
          Logger.error('Web3 Event %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }
        Logger.info('Event %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        try {
          //Call checkAndUpdateAlias of Channel Service
          const channels = Container.get(Channel)
          const result = await channels.removeDelegateeAddress(
            `${caipType}:${event.returnValues.channel}`,
            `${caipType}:${event.returnValues.delegate}`
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }

        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })

      //Add User Settings
      Logger.info(
        `Listening on Blockchain for Emit -- UserNotifcationSettingsAdded(address _channel, address _user,    uint256 _notifID,
          string _notifSettings)`
      )
      epnsContract.events.UserNotifcationSettingsAdded(async (error, event) => {
        const eventName = 'UserNotifcationSettingsAdded'
        if (error) {
          Logger.error('Web3 Event %s errored before start: %o', eventName, error)

          // disconnect provider and recoonect
          blockchainProvider.disconnect()
          listenToWeb3SocketAfterError()

          return false
        }
        Logger.info('Event %s Detected: %o', eventName, event)
        Logger.debug('Verifying and Taking Appropriate Action...')

        // Reset timeout as well
        resetTimeoutValue()

        try {
          //Call checkAndUpdateAlias of Channel Service
          const channels = Container.get(ChannelsService)
          const result = await channels.setUserSetting(
            `eip155:${event.returnValues._user}`,
            `${caipType}:${event.returnValues._channel}`,
            event.returnValues_notifSettings
          )
        } catch (err) {
          Logger.error('Event %s skipped : %o', eventName, err)
        }

        Logger.info('Web3 Event -- %s Completed (with or without error)', eventName)
      })
    }
  }

  // Listen to Web3 Socket
  listenToWeb3Socket()
}
