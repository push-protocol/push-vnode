import { toString } from 'lodash'

import config from '../config'
import {
  caip10ToWallet,
  isValidNFTAddress,
  isValidNFTAddressV2,
  isValidSCWAddress
} from './chatHelper'
import { isValidAddress } from './utilsHelper'

/**
 *
 * @param addressinCAIP This address can be in the CAIP10 format (example: eip155:1:0xabc) or in the changed format eip155:0xabc (without the chainId). When this happens, the chainId will be null
 * @returns
 */
export const convertTransactionCaipToObject = function (addressinCAIP: string): {
  result: { chainId: string | null; chain: string; transactionHash: string }
} {
  const addressComponent = addressinCAIP.split(':')
  if (addressComponent.length === 3) {
    return {
      result: {
        chain: addressComponent[0],
        chainId: addressComponent[1],
        transactionHash: addressComponent[2]
      }
    }
  } else if (addressComponent.length === 2) {
    return {
      result: {
        chain: addressComponent[0],
        chainId: null,
        transactionHash: addressComponent[1]
      }
    }
  } else {
    throw new Error('Invalid CAIP Format')
  }
}
/**
 *
 * @param addressesinCAIP This address can be in the CAIP10 format (example: eip155:1:0xabc) or in the changed format eip155:0xabc (without the chainId). When this happens, the chainId will be null
 * @returns
 */
export const batchConvertCaipToAddresses = function (addressesinCAIP: string[]): string[] {
  const addresses = addressesinCAIP.map((addressInCAIP) => {
    return convertCaipToAddress(addressInCAIP).result as string
  })
  return addresses
}

export const isValidCAIP = function (address: string) {
  if (address == null) {
    return false
  }

  const result = address.split(':')
  if (result.length == 3 && isValidAddress(result[2])) {
    return true
  } else {
    return false
  }
}
export const caipConversionByType = function (address: string, blockChainType: string) {
  if (!isValidAddress(address)) {
    throw new Error('Invalid Address')
  }

  let caipAddress
  if (blockChainType === 'ETH_TEST_SEPOLIA') {
    caipAddress = 'eip155:11155111:' + address
  } else if (blockChainType === 'ETH_MAINNET') {
    caipAddress = 'eip155:1:' + address
  } else if (blockChainType === 'POLYGON_TEST_AMOY') {
    caipAddress = 'eip155:80002:' + address
  } else if (blockChainType === 'POLYGON_MAINNET') {
    caipAddress = 'eip155:137:' + address
  } else {
    throw new Error('Invalid BlockChain Type')
  }
  return caipAddress
}
export const caipConversionForTransactionByType = function (
  address: string,
  blockChainType: string
) {
  let caipAddress
  if (blockChainType === 'ETH_TEST_SEPOLIA') {
    caipAddress = 'eip155:11155111:' + address
  } else if (blockChainType === 'ETH_MAINNET') {
    caipAddress = 'eip155:1:' + address
  } else if (blockChainType === 'POLYGON_TEST_AMOY') {
    caipAddress = 'eip155:80002:' + address
  } else if (blockChainType === 'POLYGON_MAINNET') {
    caipAddress = 'eip155:137:' + address
  } else {
    throw new Error('Invalid BlockChain Type')
  }
  return caipAddress
}
export const caipConversionByID = function (address: string, blockChainId: number) {
  // console.log('caipConversionByID for : %s and for chainId: %s', address, blockChainId)
  if (!isValidAddress(address)) {
    throw new Error('Invalid Address')
  }

  let caipAddress
  if (blockChainId === 11155111) {
    caipAddress = 'eip155:11155111:' + address
  } else if (blockChainId === 1) {
    caipAddress = 'eip155:1:' + address
  } else if (blockChainId === 80002) {
    caipAddress = 'eip155:80002:' + address
  } else if (blockChainId === 137) {
    caipAddress = 'eip155:137:' + address
  } else if (blockChainId === 97) {
    caipAddress = 'eip155:97:' + address
  } else if (blockChainId === 421614) {
    caipAddress = 'eip155:421614:' + address
  } else if (blockChainId === 11155420) {
    caipAddress = 'eip155:11155420:' + address
  } else if (blockChainId === 2442) {
    caipAddress = 'eip155:2442:' + address
  } else if (blockChainId === 56) {
    caipAddress = 'eip155:56:' + address
  } else if (blockChainId === 42161) {
    caipAddress = 'eip155:42161:' + address
  } else if (blockChainId === 10) {
    caipAddress = 'eip155:10:' + address
  } else if (blockChainId === 80085) {
    caipAddress = 'eip155:80085:' + address
  } else if (blockChainId === 59141) {
    caipAddress = 'eip155:59141:' + address
  } else if (blockChainId === 7560) {
    caipAddress = 'eip155:7560:' + address
  } else if (blockChainId === 111557560) {
    caipAddress = 'eip155:111557560:' + address
  } else if (blockChainId === 84532) {
    caipAddress = 'eip155:84532:' + address
  } else if (blockChainId === 8453) {
    caipAddress = 'eip155:8453:' + address
  } else {
    throw new Error('Invalid BlockChain Type')
  }
  return caipAddress
}
export const convertAddressToCaip = function (
  address: string,
  chainId: number
): { result: string; err: string | null } {
  if (isValidAddress(address)) {
    return { result: 'eip155' + ':' + toString(chainId) + ':' + address, err: null }
  } else {
    throw new Error('Invalid Address')
  }
}
export const convertAddressToPartialCaip = function (address: string): {
  result: string
  err: string | null
} {
  if (isValidAddress(address)) {
    return { result: 'eip155' + ':' + address, err: null }
  } else {
    throw new Error('Invalid Address')
  }
}
/**
 * @param addressinPartialCAIP This address can be a valid eth address in partial CAIP format
 * @returns
 */
export const isValidPartialCAIP10Address = function (addressinPartialCAIP: string): boolean {
  try {
    if (
      isValidNFTAddress(addressinPartialCAIP) ||
      isValidNFTAddressV2(addressinPartialCAIP) ||
      isValidSCWAddress(addressinPartialCAIP)
    ) {
      return true
    }

    const addressComponent = addressinPartialCAIP.split(':')
    if (addressComponent.length === 2 && addressComponent[0] == 'eip155') return true
    return false
  } catch (err) {
    return false
  }
}
export const isValidCAIP10Address = function (addressinCAIP: string): boolean {
  try {
    if (
      isValidNFTAddress(addressinCAIP) ||
      isValidNFTAddressV2(addressinCAIP) ||
      isValidSCWAddress(addressinCAIP)
    ) {
      return true
    }
    const addressComponent = addressinCAIP.split(':')
    if (
      addressComponent.length === 3 &&
      addressComponent[0] == 'eip155' &&
      isValidAddress(addressComponent[2])
    )
      return true
    return false
  } catch (err) {
    return false
  }
}
/**
 * @param addressinCAIP This address can be in the CAIP10 format (example: eip155:1:0xabc) or in the changed format eip155:0xabc (without the chainId). When this happens, the chainId will be null
 * @returns
 */
export const convertCaipToObject = function (addressinCAIP: string): {
  result: { chainId: string | null; chain: string; address: string }
} {
  const addressComponent = addressinCAIP.split(':')
  if (addressComponent.length === 3 && isValidAddress(addressComponent[2])) {
    return {
      result: {
        chain: addressComponent[0],
        chainId: addressComponent[1],
        address: addressComponent[2]
      }
    }
  } else if (addressComponent.length === 2 && isValidAddress(addressComponent[1])) {
    return {
      result: {
        chain: addressComponent[0],
        chainId: null,
        address: addressComponent[1]
      }
    }
  } else {
    throw new Error('Invalid CAIP Format')
  }
}

/**
 * @param addressinPartialCAIP This address can be a valid eth address in partial CAIP format
 * @returns
 */
export const isAddressAlias = function (addressinPartialCAIP) {
  try {
    if (
      isValidNFTAddress(addressinPartialCAIP) ||
      isValidNFTAddressV2(addressinPartialCAIP) ||
      isValidSCWAddress(addressinPartialCAIP)
    ) {
      return false
    }

    const supportedAliasIds = config.supportedAliasIds
    const addressParts = addressinPartialCAIP.split(':')
    const firstTwoParts = addressParts.slice(0, 2).join(':')

    return supportedAliasIds.includes(firstTwoParts)
  } catch (err) {
    return false
  }
}

/**
 * @param addressinCAIP This address can be in the CAIP10 format (example: eip155:1:0xabc) or in the changed format eip155:0xabc (without the chainId). When this happens, the chainId will be null
 * @returns
 */
export const convertCaipToAddress = function (addressinCAIP: string): {
  result: string
  err: string | null
} {
  if (
    isValidNFTAddress(addressinCAIP) ||
    isValidNFTAddressV2(addressinCAIP) ||
    isValidSCWAddress(addressinCAIP)
  ) {
    return { result: addressinCAIP, err: null }
  }
  const addressComponent = addressinCAIP.split(':')
  if (
    addressComponent.length === 3 &&
    addressComponent[0] === 'eip155' &&
    isValidAddress(addressComponent[2])
  ) {
    return { result: addressComponent[2], err: null }
  }
  // Wallet can be in the new caip10 format used in w2w: eip155:walletAddress
  else if (
    addressComponent.length === 2 &&
    addressComponent[0] === 'eip155' &&
    isValidAddress(addressComponent[1])
  ) {
    const wallet = caip10ToWallet(addressinCAIP)
    return { result: wallet, err: null }
  } else {
    throw new Error('Invalid CAIP Format')
  }
}

/**
 * @param address This address can be in the CAIP10 format (example: eip155:1:0xabc) or or in the changed format eip155:0xabc (without the chainId) or just the wallet address 0xabc.
 * @returns {result: string, err: string | null}
 */
export const getChannelAddressfromEthAddress = function (address: string): string {
  const addressComponent = address.split(':')
  try {
    if (addressComponent.length === 3 && isValidAddress(addressComponent[2])) {
      return address
    } else if (addressComponent.length === 2 && isValidAddress(addressComponent[1])) {
      // Wallet can be in the new caip10 format used in w2w: eip155:walletAddress
      return address
    } else if (addressComponent.length === 1 && isValidAddress(address)) {
      return `${config.ethereumId}:${address}`
    } else {
      throw new Error('Invalid address Format')
    }
  } catch (err) {
    return null
  }
}
