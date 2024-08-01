import { recoverTypedSignature_v4 as recoverTypedSignatureV4 } from 'eth-sig-util'
import { ethers } from 'ethers'
import { Container } from 'typedi'

import config from '../config/index'
import Channel from '../services/channelsCompositeClasses/channelsClass'
import * as epnsAPIHelper from './epnsAPIHelper'
import isIPFS = require('is-ipfs')
import _ from 'lodash'
import { Logger } from 'winston'

import { getChatByThreadhash } from '../db-access/w2w'
import { Chat, GroupType, Message } from '../interfaces/chat'
import { convertCaipToAddress, convertCaipToObject } from './caipHelper'
const payloadHelper = require('./payloadHelper')
import CryptoJs from 'crypto-js'

import * as w2wRepository from '../db-access/w2w'
import { VIDEO_CALL_STATUS, VIDEO_NOTIFICATION_ACCESS_TYPE } from '../enums/video'
import { verifySignature } from '../helpers/chatHelper'
import { SendNotificationRules } from '../interfaces/notification'

const PAYLOAD_DELIMITER = '+'
const ADDITIONAL_META_TYPE_DELIMITER = '+'

const PAYLOAD_FIELDS = ['data', 'notification']
const PAYLOAD_DATA_FIELDS = ['acta', 'aimg', 'amsg', 'asub', 'type']
const PAYLOAD_NOTIFICATION_FIELDS = ['title', 'body']

module.exports = {
  verifyChannelSpecificInformation: async (
    sender: string
  ): Promise<{ success: boolean; channel: string | null }> => {
    const logger: Logger = Container.get('logger')
    try {
      logger.info('Trying to call verifyChannelSpecificInformation')
      const channels = Container.get(Channel)
      const senderObj = convertCaipToObject(sender)
      const channelDetail = await channels.getChannel(sender)

      // It came from eth channel
      if (senderObj && senderObj.result && senderObj.result.chainId == config.ethereumChainId) {
        logger.info('Trying to verify channel info from Core Chain')
        // no channel details were returned
        if (!channelDetail) {
          return {
            success: false,
            channel: null
          }
        }
        // either channel is blocked or deactivated
        if (channelDetail.blocked == 1 || channelDetail.activation_status == 0) {
          logger.info('Channel is bocked or deactivated')
          return {
            success: false,
            channel: null
          }
        } else {
          logger.info('Successfully verified')
          return {
            success: true,
            channel: channelDetail.channel
          }
        }
      } else if (
        senderObj &&
        senderObj.result &&
        config.supportedAliasIds.includes(`${senderObj.result.chain}:${senderObj.result.chainId}`)
      ) {
        logger.info(
          `Trying to verify channel info for Alias Chain with chain id ${senderObj.result.chainId}`
        )
        const aliasDetail = await channels.getAliasDetails(sender)
        if (!aliasDetail) {
          return {
            success: false,
            channel: null
          }
        }
        if (
          aliasDetail.is_alias_verified == 0 ||
          aliasDetail.blocked == 1 ||
          aliasDetail.activation_status == 0
        ) {
          logger.info('Alias is not verified or bocked or deactivated')
          return {
            success: false,
            channel: null
          }
        } else {
          logger.info('Successfully verified')
          return {
            success: true,
            channel: aliasDetail.channel
          }
        }
      } else {
        logger.info('Failed both channel and alias check')
        return {
          success: false,
          channel: null
        }
      }
    } catch (error) {
      logger.error(error)
      return { success: false, channel: null }
    }
  },
  // To verify the entire payload
  verifyPayload: async function (
    verificationProof,
    channel,
    recipient,
    source,
    identityBytes
  ): Promise<{ success: boolean; err: string | null }> {
    const logger: Logger = Container.get('logger')
    logger.info('Trying to call verifyPayload %o', identityBytes)

    const deconstructedVerificationProof =
      payloadHelper.segregateVerificationProof(verificationProof)
    // Always bytes so convert to string
    if (!identityBytes)
      return {
        success: false,
        err: `Payload Identity Bytes is not valid: vType: ${deconstructedVerificationProof.verificationType}, vProof: ${deconstructedVerificationProof.verificationProof}, identityBytes: ${identityBytes}`
      }
    const deconstructedPayload = payloadHelper.segregatePayloadIdentity(identityBytes)
    // Check deconstructed payload
    if (!deconstructedPayload.success)
      return { success: false, err: 'Payload Identity is not valid' }

    // Check payload storage is supported
    if (!this.verifyPayloadIdentityStorage(deconstructedPayload.storageType, PAYLOAD_DELIMITER))
      return {
        success: false,
        err: `Payload Storage Type ${deconstructedPayload.storageType} is not valid or supported`
      }
    // Check payload identity hash
    const verifyPayloadIdentityHashResponse = await this.verifyPayloadIdentityHash(
      deconstructedPayload.storageType,
      deconstructedPayload.storagePointer,
      channel,
      source
    )
    if (!verifyPayloadIdentityHashResponse.success)
      return {
        success: false,
        err: verifyPayloadIdentityHashResponse.err
      }
    logger.info('verifyPayload call completed')

    return { success: true, err: null }
  },
  verifyPayloadIdentityStorage: (storageType) => {
    const logger: Logger = Container.get('logger')
    logger.info('Trying to call verifyPayloadIdentityStorage')
    const minmax = payloadHelper.getSupportedPayloadIdentites()
    return storageType >= minmax.min && storageType <= minmax.max
  },
  verifyPayloadIdentityHash: async function (
    storageType: number,
    storagePointer: string,
    channel: string,
    source: string
  ): Promise<{ success: boolean; err: string }> {
    const logger: Logger = Container.get('logger')
    logger.info('Trying to call verifyPayloadIdentityHash')
    let success = false
    let err = ''
    if (storageType == 0) {
      // via smart contract check
      const delimiterCount = storagePointer.split(PAYLOAD_DELIMITER).length - 1
      if (delimiterCount >= 2) {
        logger.info(`Successfully verified payload identity hash for storage type ${storageType}`)
        success = true
      } else {
        err = 'Storage pointer is not in the defined format for storage type 0'
      }
    } else if (storageType == 1) {
      // via ipfs
      success = isIPFS.cid(storagePointer)
      if (!success) {
        err = 'Not a valid IPFS hash for storage type 1'
      }
    } else if (storageType == 2) {
      // via direct payload
      const jsonPayload = JSON.parse(storagePointer)
      success =
        _.every(PAYLOAD_FIELDS, _.partial(_.has, jsonPayload)) &&
        _.every(PAYLOAD_NOTIFICATION_FIELDS, _.partial(_.has, jsonPayload?.notification)) &&
        _.every(PAYLOAD_DATA_FIELDS, _.partial(_.has, jsonPayload?.data))
      if (!success) err = 'Doesnt contain appropriate parameters'
      if (
        jsonPayload.data.additionalMeta &&
        typeof jsonPayload.data.additionalMeta === 'object' &&
        jsonPayload.data.additionalMeta.type
      ) {
        const addtionalMetaVerification = this.verifyAdditionalMeta(jsonPayload.data.additionalMeta)
        success = addtionalMetaVerification.success
        err = addtionalMetaVerification.err
      }
    } else if (storageType == 3) {
      // via thegraph
      const channelService = Container.get(Channel)
      const subgraphDetails = await channelService.getSubGraphDetails(channel)
      if (
        storagePointer.split(':').length > 0 &&
        subgraphDetails &&
        subgraphDetails?.result?.subGraphId == storagePointer.split('+')[0].split(':')[1]
      ) {
        logger.info(`Successfully verified payload identity hash for storage type ${storageType}`)
        success = true
      } else {
        err = 'Storage pointer is not in the defined format for storage type 3'
      }
    } else if (storageType === 4) {
      const reference = storagePointer.split(':').slice(1).join(':') as `v2:${string}`
      try {
        const message: Message = await w2wRepository.getMessageByReference(reference)
        if (message) success = true
        else err = 'Storage pointer is not in the defined format for storage type 4'
      } catch (error) {
        logger.error(error)
        err = 'Storage pointer is not in the defined format for storage type 4'
      }
    }

    return { success, err }
  },
  verifyAdditionalMeta: function (additionalMeta: { type: string; data: string; domain: string }): {
    success: boolean
    err: string
  } {
    let success = false
    let err = ''
    if (
      !additionalMeta.type ||
      additionalMeta.type.split(ADDITIONAL_META_TYPE_DELIMITER).length !== 2
    ) {
      return {
        success: false,
        err: 'Invalid additionalMeta type structure'
      }
    }
    const [useCaseType, version] = additionalMeta.type.split(ADDITIONAL_META_TYPE_DELIMITER)

    switch (Number(useCaseType)) {
      //CUSTOM
      case config.additionalMeta.CUSTOM.type: {
        if (isNaN(Number(version))) {
          err = 'Version needs to be a number'
        }
        break
      }
      //PUSH_VIDEO
      case config.additionalMeta.PUSH_VIDEO.type: {
        const supportedVersions = config.additionalMeta.PUSH_VIDEO.version // can be extended to more versions in future
        const supportedDomains = config.additionalMeta.PUSH_VIDEO.domain
        if (!supportedVersions.includes(Number(version))) {
          err = 'Invalid version for PUSH_VIDEO'
        }
        if (!supportedDomains.includes(additionalMeta.domain)) {
          err = 'Invalid domain for PUSH_VIDEO'
        }
        break
      }
      //PUSH_SPACE
      case config.additionalMeta.PUSH_SPACE.type: {
        const supportedVersions = config.additionalMeta.PUSH_SPACE.version // can be extended to more versions in future
        const supportedDomains = config.additionalMeta.PUSH_SPACE.domain
        if (!supportedVersions.includes(Number(version))) {
          err = 'Invalid version for PUSH_SPACE'
        }
        if (!supportedDomains.includes(additionalMeta.domain)) {
          err = 'Invalid domain for PUSH_SPACE'
        }
        break
      }
      default: {
        err = 'Invalid type'
      }
    }
    if (err === '') {
      success = true
    }
    return { success, err }
  },
  verifyVerificationProof: async function (
    verificationType: string,
    verificationProof: string,
    data: string,
    sender: string,
    senderType: number,
    recipient: string,
    chainId: number,
    source: string,
    rules?: SendNotificationRules
  ): Promise<{
    response: boolean
    err: string
    delegate?: string | null
    channel?: string | null
  }> {
    const logger: Logger = Container.get('logger')
    logger.info('Trying to call verifyVerificationProof')

    let response: boolean
    let err = ''
    let delegate: string
    let channel: string

    if (senderType === config.senderType.channel && source != 'SIMULATE') {
      const channelSpecificInformation = await this.verifyChannelSpecificInformation(sender)

      if (!channelSpecificInformation.success) {
        err = 'Could not verify channel specific information'
        channel = channelSpecificInformation.channel
        return { response: false, err, delegate, channel }
      } else {
        channel = channelSpecificInformation.channel
      }
    }

    // TODO: sender need to be in CAIP format
    const channelService = Container.get(Channel)
    const delegates = (await channelService.getDelegateFromChannel(sender)).delegates
    const verifyingContract = config.MAP_ID_TO_COMM_CONTRACT[chainId]
    // Based on the verification type, call the appropriate function to verify the verification proof
    switch (verificationType) {
      case 'eip712v2':
        const recoveredWalletAddress = this.verifyEip712ProofV2(
          verificationProof,
          data,
          chainId,
          verifyingContract
        ) as string

        const validateDelagatesRes = this.checkValidDelagate(delegates, recoveredWalletAddress)

        if (
          recoveredWalletAddress.toLowerCase() ===
            convertCaipToAddress(sender).result.toLowerCase() ||
          validateDelagatesRes.verified
        ) {
          response = true
          delegate = validateDelagatesRes.delegate
          logger.info(`${recoveredWalletAddress} is the rightful signer`)
        } else {
          response = false
          logger.error(`${recoveredWalletAddress} is the not the rightful signer`)
          err = 'Error while verifying the verificationProof through eip712v2'
        }
        break
      case 'eip712v1':
        response = this.verifyEip712ProofV1(
          verificationProof,
          data,
          sender,
          chainId,
          verifyingContract,
          delegates
        )
        if (!response) err = 'Error while verifying the verificationProof through eip712v1'
        break
      case `eip155:${chainId}`:
        response = await this.verifyEip155Proof(verificationProof, sender, data, chainId)
        if (!response)
          err = `Error while verifying the verificationProof through eip155:${chainId} transaction hash`
        break
      case 'thegraph':
        response = await this.verifyGraphProof(verificationProof, sender, data, chainId)
        if (!response) err = `Error while verifying the verificationProof through thegraph`
        break
      case 'pgpv2':
        response = await this.verifyPgpProofV2(verificationProof, sender, data, rules)
        if (!response) err = 'Error while verifying the verificationProof through pgp'
        break
      case 'w2wv1':
        response = await this.verifyw2wProofV1(verificationProof)
        if (!response) err = 'Error while verifying the verificationProof through w2w'
        break
      default:
        logger.info('No verification type was attached')
        response = true
        err = 'Not a valid Verification Type'
    }
    return { response, err, delegate, channel }
  },

  checkValidDelagate: function (
    delagtes,
    signerDelegate
  ): { verified: boolean; delegate: string | null } {
    for (let i = 0; i < delagtes.length; i++)
      if (convertCaipToAddress(delagtes[i]).result.toLowerCase() == signerDelegate.toLowerCase())
        return { verified: true, delegate: delagtes[i] }
    return { verified: false, delegate: null }
  },

  verifyEip712ProofV2: function (
    signature: string,
    verifyingData: string,
    chainId: string = config.ethereumChainId,
    verifyingContract: string = config.deployedCommunicatorContractEthereum,
    isDomainEmpty: boolean = false,
    domainName: string = 'EPNS COMM V1'
  ) {
    const logger: Logger = Container.get('logger')
    try {
      const message = { data: verifyingData }
      //To get the signer address
      const domain = !isDomainEmpty
        ? {
            name: domainName,
            chainId: chainId,
            verifyingContract: verifyingContract
          }
        : {}
      const typedData = !isDomainEmpty
        ? {
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' }
              ],
              Data: [{ name: 'data', type: 'string' }]
            },
            domain: domain,
            primaryType: 'Data',
            message: message
          }
        : {
            types: {
              EIP712Domain: [],
              Data: [{ name: 'data', type: 'string' }]
            },
            domain: domain,
            primaryType: 'Data',
            message: message
          }

      const recoveredAddress = recoverTypedSignatureV4({
        data: typedData,
        sig: signature
      })
      return recoveredAddress
      //Check if the recovered address is same as the signed address
      // if (
      //   recoveredAddress.toLowerCase() === (convertCaipToAddress(channelAddress).result).toLowerCase() ||
      //   this.checkValidDelagate(delegatee, recoveredAddress)
      // ) {
      //   logger.info(`${recoveredAddress} is the rightful signer`);
      //   return true;
      // } else {
      //   logger.error(`${recoveredAddress} is the not the rightful signer`);
      //   return false;
      // }
    } catch (error) {
      logger.error('!!!Error: An error occured whie verifying signature')
      return false
    }
  },
  verifyEip712ProofV1: function (
    signature,
    verifyingData,
    channelAddress,
    chainId,
    verifyingContract,
    delegatee
  ) {
    const logger: Logger = Container.get('logger')
    try {
      const data = JSON.parse(verifyingData.split('+')[1])
      //Format the data to recover
      const domain = {
        name: 'EPNS COMM V1',
        chainId: chainId,
        verifyingContract: verifyingContract
      }
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
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
        primaryType: 'Data',
        message: data.data
      }
      //Fetch the recovered address
      const recoveredAddress = recoverTypedSignatureV4({
        data: typedData,
        sig: signature
      })
      //Check if the recovered address is same as the signed address
      if (
        recoveredAddress.toLowerCase() ===
          convertCaipToAddress(channelAddress).result.toLowerCase() ||
        this.checkValidDelagate(delegatee, recoveredAddress).verified
      ) {
        logger.info(`${recoveredAddress} is the rightful signer`)
        return true
      } else {
        logger.error(`${recoveredAddress} is the not the rightful signer`)
        return false
      }
    } catch (error) {
      logger.error('!!!Error: An error occured whie verifying signature')
      return false
    }
  },

  getDeployedContractAndNetworkConfig: function (blockchain) {
    let network
    let contractAddress
    switch (blockchain) {
      case config.ethereumChainId:
        network = config.web3EthereumNetwork
        contractAddress = config.deployedCommunicatorContractEthereum
        break
      case config.polygonChainId:
        network = config.web3PolygonNetwork
        contractAddress = config.deployedCommunicatorContractPolygon
        break
      case config.bscChainId:
        network = config.web3BscNetwork
        contractAddress = config.deployedCommunicatorContractBsc
        break
      case config.arbitrumChainId:
        network = config.web3ArbitrumNetwork
        contractAddress = config.deployedCommunicatorContractArbitrum
        break
      case config.optimismChainId:
        network = config.web3OptimismNetwork
        contractAddress = config.deployedCommunicatorContractOptimism
        break
      case config.polygonZkEVMChainId:
        network = config.web3PolygonZkEVMNetwork
        contractAddress = config.deployedCommunicatorContractPolygonZkEVM
        break
      case config.fuseId:
        network = config.web3FuseNetwork
        contractAddress = config.deployedCommunicatorContractFuse
        break
      case config.lineaChainId:
        network = config.web3LineaNetwork
        contractAddress = config.deployedCommunicatorContractLinea
        break
      case config.baseChainId:
        network = config.web3BaseNetwork
        contractAddress = config.deployedCommunicatorContractBase
        break
      case config.cyberconnectId:
        network = config.web3CyberConnectNetwork
        contractAddress = config.deployedCommunicatorContractCyberConnect
        break
      default:
        network = config.web3EthereumNetwork
        contractAddress = config.deployedCommunicatorContractEthereum
    }
    return { network, contractAddress }
  },
  // to verify transaction hash
  verifyEip155Proof: async function (transactionHash, channel, identity, blockchain) {
    const { network, contractAddress } = this.getDeployedContractAndNetworkConfig(blockchain)

    const { provider } = await epnsAPIHelper.getInteractableContracts(
      network, // Network for which the interactable contract is req
      {
        // API Keys
        etherscanAPI: config.etherscanAPI,
        infuraAPI: config.infuraAPI,
        alchemyAPI: config.alchemyAPI
      },
      null, // Private Key of the Wallet
      contractAddress, // The contract address which is going to be used
      config.deployedCommunicatorContractABI // The contract abi which is going to be useds
    )

    const transactionDetails = await provider.getTransactionReceipt(transactionHash)
    const matchObject = { address: contractAddress }
    const getContractLogs = transactionDetails.logs.filter((e) =>
      Object.keys(matchObject).every((el) => e[el].toLowerCase() === matchObject[el].toLowerCase())
    )
    const commAbiInterface = new ethers.utils.Interface(config.deployedCommunicatorContractABI)
    const eventData = commAbiInterface.decodeEventLog(
      'SendNotification',
      getContractLogs[0].data,
      getContractLogs[0].topics
    )
    return (
      eventData.channel.toLowerCase() == convertCaipToAddress(channel).result.toLowerCase() &&
      getContractLogs.length != 0 &&
      payloadHelper.convertBytesToString(eventData.identity) == identity
    )
  },
  verifyGraphProof: async (graphDetails, channel, identity, blockchain) => {
    const subgraphComponent = graphDetails.split('+')
    const subgraphId = subgraphComponent[0]
    const notificationNumber = subgraphComponent[1]

    //check subgraphId exist for this channel
    const channels = Container.get(Channel)
    const response = await channels.getSubGraphDetails(channel)
    if (response.status && response.result.subGraphId == subgraphId) {
      //check notification no in verificationProof and identity are same
      const identityComponents = identity.split(PAYLOAD_DELIMITER)
      if (identityComponents[2] == notificationNumber) {
        return true
      }
    }
    return false
  },
  /**
   * @param verificationProof - Example of verificationProof format: `cid:did:3:abcd`. DID has `:` on it. `cid` is the location where the message is stored on our local ipfs node
   */
  verifyw2wProofV1: async (verificationProof: string, sender: string): Promise<boolean> => {
    try {
      const [, referenceHash, ...items] = verificationProof.split(':')
      const reference: `v2:${string}` = `v2:${referenceHash}`
      const did: string = items.join(':')
      const message: Message = await w2wRepository.getMessageByReference(reference)
      if (message?.fromDID !== did && message?.fromDID !== sender) {
        return false
      }
      const chat: Chat = await getChatByThreadhash({ threadhash: reference })
      if (!chat?.intent.includes(message?.fromDID) && !chat?.intent.includes(message?.toDID)) {
        return false
      }
      return true
    } catch (error) {
      const logger: Logger = Container.get('logger')
      logger.error('!!!Error: An error occured whie verifying signature', error)
      return false
    }
  },
  /**
   * @param verificationProof - Example of verificationProof format: `signature:meta:chatID`.
   * @param sender - Sender of Notification eip155:<ADDRESS>
   * @param verifyingData - Payload Data of Notification which is signed
   */
  verifyPgpProofV2: async (
    verificationProof: string,
    sender: string,
    verifyingData: string,
    rules?: SendNotificationRules
  ): Promise<boolean> => {
    try {
      const [signature, tag, chatIdType, chatIdHash] = verificationProof.split(':')
      // For spaces - spaces:hash
      const chatId = chatIdType === 'spaces' ? chatIdType + ':' + chatIdHash : chatIdType

      let signedMessage: string
      //perform tag checks here
      switch (tag) {
        case 'internal': {
          const payload = JSON.parse(
            payloadHelper.segregatePayloadIdentity(verifyingData).storagePointer
          )
          signedMessage = payload.data.additionalMeta.data
          break
        }
        case 'meta':
          signedMessage = CryptoJs.SHA256(JSON.stringify({ data: verifyingData })).toString()
          break
        default:
          throw new Error('Invalid Meta Tag')
      }
      //fetch pgp public Key of sender
      const encryptionKeys = await w2wRepository.getPublicKeyEncryptedPrivateKey(sender)
      if (!encryptionKeys) {
        throw new Error("Sender doesn't have encryption keys")
      }
      //check if the above message was signed by sender or not
      const isSignatureValid: boolean = await verifySignature({
        messageContent: signedMessage,
        signatureArmored: signature,
        publicKeyArmored: encryptionKeys.publicKeyArmored
      })
      if (!isSignatureValid) {
        throw new Error('Invalid signature')
      }

      // Fetch chat by chatID to check if sender is part of Chat or not
      const chat: Chat = await w2wRepository.getChatByChatId({ chatId })
      if (!chat) {
        throw new Error('Invalid chatId')
      }
      if (!chat.combinedDID.includes(sender)) {
        throw new Error('Sender is not a member of this chat')
      }
      if (!chat.intent.includes(sender)) {
        throw new Error('Sender must first approve the intent')
      }

      // Access controlling video notifications
      if (rules && rules.access.type === VIDEO_NOTIFICATION_ACCESS_TYPE.PUSH_CHAT) {
        // Check if the verifyingData starts with '2+' to ensure it's a direct payload
        // Throw an error if it's not, as video notifications are only permitted with direct payloads
        if (!verifyingData.startsWith('2+')) {
          throw new Error('Direct payload is required for video notifications')
        }

        // Extracting notification payload from verifyingData
        const notificationPayloadJSON = verifyingData.slice(2)
        if (!notificationPayloadJSON) {
          throw new Error('Invalid verifying data')
        }

        // Parsing notification payload and extracting additionalMeta
        const {
          data: { additionalMeta }
        } = JSON.parse(notificationPayloadJSON)
        if (
          !additionalMeta ||
          Number(additionalMeta.type.split(ADDITIONAL_META_TYPE_DELIMITER)[0]) !==
            config.additionalMeta.PUSH_VIDEO.type ||
          !additionalMeta.data
        ) {
          throw new Error('Either additional meta not found or invalid for video notification')
        }

        let videoCallStatus

        try {
          const additionalMetaData = JSON.parse(additionalMeta.data)

          if (!additionalMetaData.status) {
            throw new Error(`'status' property not found in additional meta data`)
          }

          // Extract video call status from additionalMeta data
          videoCallStatus = Number(additionalMetaData.status)
        } catch (err) {
          // If JSON parsing of additionalMeta.data fails or additionalMetaData.status is not found, return true
          return true
        }

        // Validating video call status against predefined constants
        if (!(videoCallStatus in VIDEO_CALL_STATUS)) {
          throw new Error('Invalid video call status received')
        }

        // Validating specific conditions for INITIALIZED video call notification in a group chat
        if (
          videoCallStatus === VIDEO_CALL_STATUS.INITIALIZED &&
          chat.groupName &&
          chat.groupType === GroupType.DEFAULT
        ) {
          // Ensuring that INITIALIZED video call notification in a group chat can only be fired by the creator or admins
          if (!chat.admins.includes(sender)) {
            throw new Error('Only group creator, admins are allowed to initiate a group video call')
          }
        }
      }

      return true
    } catch (error) {
      const logger: Logger = Container.get('logger')
      logger.error('!!!Error: An error occured whie verifying verification proof', error)
      return false
    }
  }
}
