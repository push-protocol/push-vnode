import { recoverTypedSignature_v4 as recoverTypedSignatureV4 } from 'eth-sig-util'
import { Container } from 'typedi'

import config from '../config'
import {
  IChannelAndAliasVerificationResponse,
  ISubscribeResponse
} from '../interfaces/notification/subscribers'
import Alias from '../services/channelsCompositeClasses/aliasClass'
import Channel from '../services/channelsCompositeClasses/channelsClass'
import { caipConversionByID, isValidCAIP } from './caipHelper'
module.exports = {
  verifySubscribeData(
    verificationProof: string,
    data: object,
    chainId: string,
    contractAddress: string,
    source: string
  ): ISubscribeResponse {
    let response: ISubscribeResponse = {
      success: null,
      error: null,
      verified: null
    }
    try {
      if (source == 'eip712') {
        if (verificationProof.split(':').length == 2) {
          response = this.verifyOffchainSubscribe(
            verificationProof.split(':')[1],
            data,
            chainId,
            contractAddress
          )
        }
      } else if (source.includes('eip155')) {
        response.error = null
        response.success = true
        response.verified = true
        response.isDataFromEVMLog = true
      } else if (source == 'eip712v2' && verificationProof.split(':').length == 2) {
        response = this.verifyOffchainSubscribeV2(
          verificationProof.split(':')[1],
          JSON.stringify(data, null, 4),
          chainId,
          contractAddress
        )
      } else {
        response.error = 'Invalid source'
        response.success = false
        response.verified = false
      }

      return response
    } catch (error) {
      response.error = error
      response.success = false
      response.verified = false
      return response
    }
  },
  verifyUnsubscribeData(
    verificationProof: string,
    data: object,
    chainId: string,
    contractAddress: string,
    source: string
  ): ISubscribeResponse {
    let response: ISubscribeResponse = {
      success: null,
      error: null,
      verified: null
    }
    try {
      if (source == 'eip712') {
        if (verificationProof.split(':').length == 2) {
          response = this.verifyOffchainUnsubscribe(
            verificationProof.split(':')[1],
            data,
            chainId,
            contractAddress
          )
        }
      } else if (source.includes('eip155')) {
        response.error = null
        response.success = true
        response.verified = true
      } else if (source == 'eip712v2' && verificationProof.split(':').length == 2) {
        response = this.verifyOffchainUnsubscribeV2(
          verificationProof.split(':')[1],
          JSON.stringify(data, null, 4),
          chainId,
          contractAddress
        )
      } else {
        response.error = 'Invalid source'
        response.success = false
        response.verified = false
      }

      return response
    } catch (error) {
      response.error = error
      response.success = false
      response.verified = false
      return response
    }
  },
  verifyOffchainSubscribe(
    signature: string,
    message: object,
    chainId: number,
    contractAddress: any
  ): ISubscribeResponse {
    try {
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
          ],
          Subscribe: [
            { name: 'channel', type: 'address' },
            { name: 'subscriber', type: 'address' },
            { name: 'action', type: 'string' }
          ]
        },
        domain: {
          name: 'EPNS COMM V1',
          chainId: chainId,
          verifyingContract: contractAddress
        },
        primaryType: 'Subscribe',
        message: message
      }

      const recoveredAddress = recoverTypedSignatureV4({
        data: typedData,
        sig: signature
      })
      if (recoveredAddress.toLowerCase() == message.subscriber.toLowerCase())
        return { success: true, verified: true, error: null }
      else return { success: true, verified: false, error: null }
    } catch (error) {
      return { success: false, verified: false, error: error }
    }
  },

  verifyOffchainSubscribeV2(
    signature: string,
    message: string,
    chainId: number,
    contractAddress: any
  ): ISubscribeResponse {
    try {
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
          ],
          Data: [{ name: 'data', type: 'string' }]
        },
        domain: {
          name: 'EPNS COMM V1',
          chainId: chainId,
          verifyingContract: contractAddress
        },
        primaryType: 'Data',
        message: { data: message }
      }

      const recoveredAddress = recoverTypedSignatureV4({
        data: typedData,
        sig: signature
      })
      if (recoveredAddress.toLowerCase() == JSON.parse(message).subscriber.toLowerCase())
        return { success: true, verified: true, error: null }
      else return { success: true, verified: false, error: null }
    } catch (error) {
      return { success: false, verified: false, error: error }
    }
  },

  verifyOffchainUnsubscribeV2(
    signature: string,
    message: string,
    chainId: number,
    contractAddress: any
  ): ISubscribeResponse {
    try {
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
          ],
          Data: [{ name: 'data', type: 'string' }]
        },
        domain: {
          name: 'EPNS COMM V1',
          chainId: chainId,
          verifyingContract: contractAddress
        },
        primaryType: 'Data',
        message: { data: message }
      }

      const recoveredAddress = recoverTypedSignatureV4({
        data: typedData,
        sig: signature
      })
      if (recoveredAddress.toLowerCase() == JSON.parse(message).unsubscriber.toLowerCase())
        return { success: true, verified: true, error: null }
      else return { success: true, verified: false, error: null }
    } catch (error) {
      return { success: false, verified: false, error: error }
    }
  },

  verifyOffchainUnsubscribe(
    signature: string,
    message: object,
    chainId: number,
    contractAddress: any
  ) {
    try {
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
          ],
          Unsubscribe: [
            { name: 'channel', type: 'address' },
            { name: 'unsubscriber', type: 'address' },
            { name: 'action', type: 'string' }
          ]
        },
        domain: {
          name: 'EPNS COMM V1',
          chainId: chainId,
          verifyingContract: contractAddress
        },
        primaryType: 'Unsubscribe',
        message: message
      }

      const recoveredAddress = recoverTypedSignatureV4({
        data: typedData,
        sig: signature
      })
      if (recoveredAddress.toLowerCase() == message.unsubscriber.toLowerCase())
        return { success: true, verified: true, error: null }
      else return { success: true, verified: false, error: null }
    } catch (error) {
      return { success: false, error: error, verified: false }
    }
  },

  async verifyChannelAndAlias(
    blockchain: string,
    channel: string
  ): Promise<IChannelAndAliasVerificationResponse | String> {
    return await new Promise(async (resolve, reject) => {
      const channels = Container.get(Channel)
      const alias = Container.get(Alias)
      if (blockchain != config.ethereumChainId) {
        // get the alias and verify if its valid or not
        const aliasDetail = await channels.getAliasDetails(channel)
        const ethAddress = aliasDetail && aliasDetail.channel
        const { status } = await alias.isAliasVerified(channel)
        if (status == false) {
          resolve({
            success: false,
            error: 'Alias is not verified',
            ethAddress: null,
            aliasAddress: null,
            channelSetting: null
          })
        } else {
          const channelSetting = await channels.getChannelSettings(channel)
          resolve({
            success: true,
            ethAddress: isValidCAIP(ethAddress)
              ? ethAddress
              : caipConversionByID(ethAddress, config.ethereumChainId),
            aliasAddress: isValidCAIP(channel) ? channel : caipConversionByID(channel, blockchain),
            error: null,
            channelSetting: channelSetting.result
          })
        }
      } else if (blockchain == config.ethereumChainId) {
        // const channelDetail = await channels.getChannel(channel);
        const { aliasAddress } = await alias.getAliasFromEthChannel(channel)
        const { status } = await alias.isAliasVerified(aliasAddress)
        const channelSetting = await channels.getChannelSettings(channel)
        // if(channelDetail)
        resolve({
          success: true,
          ethAddress: isValidCAIP(channel)
            ? channel
            : caipConversionByID(channel, config.ethereumChainId),
          aliasAddress: status && aliasAddress ? aliasAddress : null,
          error: null,
          channelSetting: channelSetting.result
        })
        // resolve({ success: false, error: 'Channel doesnt exists', ethAddress: null, aliasAddress: null });
      } else {
        resolve({
          success: false,
          error: 'Invalid blockchain parameter',
          ethAddress: null,
          aliasAddress: null,
          channelSetting: null
        })
      }
    })
  }
}
