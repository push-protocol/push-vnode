import blockies from 'ethereum-blockies-png'
import { ethers } from 'ethers'
import * as openpgp from 'openpgp'
import { adjectives, animals, colors, uniqueNamesGenerator } from 'unique-names-generator'
import { TextEncoder } from 'util'

import config from '../config'
import ERC20_ABI from './erc20.json'
import NFT_ABI from './nft.json'
import { isValidActualCAIP10Address, isValidAddress } from './utilsHelper'
const gr = require('graphql-request')
const { request, gql } = gr
import { UserV2 } from '../interfaces/chat'
import { client as redisClient } from '../loaders/redis'
export const NFT_OWNER_PREFIX_KEY = 'nft_owner:'
import axios from 'axios'

import * as w2wRepository from '../db-access/w2w'
import {
  AdditionalRuleMeta,
  Condition,
  ConditionBase,
  ConditionType,
  Data,
  Rules
} from '../interfaces/chat/groupChat'

export function combinedWalletDID({ firstDID, secondDID }): { combinedDID: string } {
  const didArray: string[] = [firstDID, secondDID]
  didArray.sort((a, b) => (a > b ? 1 : b > a ? -1 : 0))
  const combinedDID = didArray.join('_')

  return { combinedDID: combinedDID }
}

export const getSizeInBytes = (obj: string | object): number => {
  let str = null
  if (typeof obj === 'string') {
    // If obj is a string, then use it
    str = obj
  } else {
    // Else, make obj into a string
    str = JSON.stringify(obj)
  }
  // Get the length of the Uint8Array
  const bytes: number = new TextEncoder().encode(str).length
  return bytes
}

// This method is used in nft flows as well, where nft wallet is passed, probably need more analyses about its usage in the nft user flow. As of now it looks to be ok.
export const caip10ToWallet = (wallet: string) => {
  if (wallet.split(':').length === 2) {
    wallet = wallet.replace('eip155:', '')
    return isValidAddress(wallet) ? wallet : false
  } else {
    return false
  }
}

export const createRandomNameAndProfile = (
  wallet: string
): { uniqueName: string; uniqueAvatar: string } => {
  const uniqueName = uniqueNamesGenerator({
    dictionaries: [colors, adjectives, animals],
    separator: '-'
  })
  wallet = caip10ToWallet(wallet)
  const uniqueAvatar = blockies.createDataURL({ seed: wallet })
  return { uniqueName: uniqueName, uniqueAvatar: uniqueAvatar }
}

export const isValidCAIP10Address = (wallet: string): boolean => {
  const walletComponent = wallet.split(':')
  return (
    (walletComponent.length === 2 &&
      walletComponent[0] === 'eip155' &&
      isValidAddress(walletComponent[1])) ||
    isValidNFTAddress(wallet) ||
    isValidSCWAddress(wallet)
  )
}

// Check with out the random hash
export const isValidNFTAddressV2 = (address: string): boolean => {
  const addressComponents = address.split(':')
  return (
    addressComponents.length === 5 &&
    addressComponents[0].toLowerCase() === 'nft' &&
    addressComponents[1].toLowerCase() === 'eip155' &&
    !isNaN(Number(addressComponents[2])) &&
    Number(addressComponents[2]) > 0 &&
    ethers.utils.isAddress(addressComponents[3]) &&
    !isNaN(Number(addressComponents[4])) &&
    Number(addressComponents[4]) > 0
  )
}

// nft:eip155:nftChainId:nftContractAddress:nftTokenId:RandomHash
export const isValidNFTAddress = (address: string): boolean => {
  const addressComponents = address.split(':')
  const epochRegex = /^[0-9]{10}$/
  return (
    addressComponents.length === 6 &&
    addressComponents[0].toLowerCase() === 'nft' &&
    addressComponents[1].toLowerCase() === 'eip155' &&
    !isNaN(Number(addressComponents[2])) &&
    Number(addressComponents[2]) > 0 &&
    ethers.utils.isAddress(addressComponents[3]) &&
    !isNaN(Number(addressComponents[4])) &&
    Number(addressComponents[4]) > 0 &&
    epochRegex.test(addressComponents[5])
  )
}

// scw:eip155:scwChainId:scwContractAddress
export const isValidSCWAddress = (address: string): boolean => {
  const addressComponents = address.split(':')
  return (
    addressComponents.length === 4 &&
    addressComponents[0].toLowerCase() === 'scw' &&
    addressComponents[1].toLowerCase() === 'eip155' &&
    !isNaN(Number(addressComponents[2])) &&
    Number(addressComponents[2]) > 0 &&
    ethers.utils.isAddress(addressComponents[3])
  )
}

export const verifySignature = async ({
  messageContent,
  signatureArmored,
  publicKeyArmored
}: {
  messageContent: string
  signatureArmored: string
  publicKeyArmored: string
}): Promise<boolean> => {
  const message: openpgp.Message<string> = await openpgp.createMessage({
    text: messageContent
  })
  const signature: openpgp.Signature = await openpgp.readSignature({
    armoredSignature: signatureArmored
  })
  const publicKey: openpgp.PublicKey = await openpgp.readKey({
    armoredKey: publicKeyArmored
  })
  const verificationResult = await openpgp.verify({
    // setting date to 1 day in the future to avoid issues with clock skew
    date: new Date(Date.now() + 1000 * 60 * 60 * 24),
    message,
    signature,
    verificationKeys: publicKey
  })
  const { verified, keyID } = verificationResult.signatures[0]
  try {
    await verified
    return true
  } catch (e) {
    console.log('Signature could not be verified: ' + e)
    return false
  }
}

export async function checkBlockStatus(
  userFrom: UserV2,
  userTo: UserV2
): Promise<{ success: boolean; error: string } | null> {
  // Check if userTo has blocked userFrom
  if (userTo.profile.blockedUsersList && userTo.profile.blockedUsersList.includes(userFrom.did)) {
    const returnMessage = `User ${userTo.did} has blocked ${userFrom.did}. Operation not allowed.`
    return { success: false, error: returnMessage }
  }

  // Also check if userFrom has blocked userTo
  if (userFrom.profile.blockedUsersList && userFrom.profile.blockedUsersList.includes(userTo.did)) {
    const returnMessage = `User ${userFrom.did} has blocked ${userTo.did}. Operation not allowed.`
    return { success: false, error: returnMessage }
  }

  // If no blocks found, return null
  return { success: true, error: null }
}

export async function numberOfERC20Tokens(
  contractAddressCaip10: string,
  userCaip10: string
): Promise<{ err: string; result: ethers.BigNumber }> {
  try {
    const chainId = contractAddressCaip10.split(':')[1]
    const provider = await getProvider(chainId)
    if (!provider) return { err: `Invalid ChainId ${chainId}`, result: ethers.BigNumber.from(0) }
    const contractAddress = contractAddressCaip10.split(':')[2]
    const wallet = caip10ToWallet(userCaip10)
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider)
    const balance: ethers.BigNumber = await contract.balanceOf(wallet)
    return { err: null, result: balance }
  } catch (err) {
    // Exception is thrown when address is from EOA instead from account
    return {
      err: `Invalid erc20 address ${contractAddressCaip10}`,
      result: ethers.BigNumber.from(0)
    }
  }
}

export async function checkNFTOwnership(
  chainId: string,
  address: string,
  contractAddress: string,
  tokenId: string | number
): Promise<boolean> {
  try {
    const provider = await getProvider(chainId)
    if (!provider) {
      console.log('Provider not configured for chainId :: ' + chainId)
      return false
    }
    const contract = new ethers.Contract(contractAddress, NFT_ABI, provider)
    const tokenURI = await contract.ownerOf(tokenId)
    return tokenURI.toLowerCase().includes(address.toLowerCase())
  } catch (error) {
    // Exception is thrown in case user doesn't hold NFT
    return false
  }
}

export async function getNFTOwner(caip10: string): Promise<string> {
  try {
    const [nft, eip155, chainId, contractAddress, tokenId, randomHash] = caip10.split(':')

    const provider = await getProvider(chainId)
    if (!provider) {
      console.log('Provider not configured for chainId :: ' + chainId)
      throw new Error('Error in getNFTOwner: Provider not configured for chainId :: ' + chainId)
    }

    const contract = new ethers.Contract(contractAddress, NFT_ABI, provider)
    const owner = await contract.ownerOf(tokenId)
    const nftOwner = 'eip155:' + owner.toLowerCase()

    await saveNFTOwner(caip10, nftOwner)

    return nftOwner
  } catch (error) {
    throw new Error('Error in getNFTOwner: ' + error.message)
  }
}

export async function getNFTOwnerFromLocal(caip10: string): Promise<string | null> {
  try {
    const nftOwner = await redisClient.get(NFT_OWNER_PREFIX_KEY + caip10)
    return nftOwner
  } catch (error) {
    console.log('Error in getNFTOwnerFromLocal: ' + error.message)
    return null
  }
}

export async function saveNFTOwner(caip10: string, nftOwner: string): Promise<void> {
  await redisClient.set(NFT_OWNER_PREFIX_KEY + caip10, nftOwner)
  await redisClient.expire(NFT_OWNER_PREFIX_KEY + caip10, 3600 * 12 * 30)
}

export async function getProvider(
  chainId: string
): Promise<ethers.providers.JsonRpcProvider> | null {
  const providerUrl = config.CHAIN_ID_TO_PROVIDER[chainId]
  if (!providerUrl) {
    return null
  }
  return new ethers.providers.JsonRpcProvider(providerUrl)
}

export async function numberOfNFTTokens(
  contractAddressCaip10: string,
  userCaip10: string
): Promise<{ err: string; result: ethers.BigNumber }> {
  try {
    const chainId = contractAddressCaip10.split(':')[1]
    const provider = await getProvider(chainId)

    if (!provider) return { err: `Invalid ChainId ${chainId}`, result: ethers.BigNumber.from(0) }
    const contractAddress = contractAddressCaip10.split(':')[2]

    const wallet = caip10ToWallet(userCaip10)

    const contract = new ethers.Contract(contractAddress, NFT_ABI, provider)
    const balance: ethers.BigNumber = await contract.balanceOf(wallet)
    return { err: null, result: balance }
  } catch (err) {
    // Exception is thrown when address is from EOA instead from account
    return {
      err: `Invalid erc721 address ${contractAddressCaip10}`,
      result: ethers.BigNumber.from(0)
    }
  }
}

export function arraysEqual(a: any[], b: any[]): boolean {
  if (a === b) return true
  if (a == null || b == null) return false

  const sortedA = [...a].sort()
  const sortedB = [...b].sort()

  if (sortedA.length != sortedB.length) return false

  for (let i = 0; i < sortedA.length; ++i) {
    if (sortedA[i] !== sortedB[i]) return false
  }
  return true
}

export async function verifyGitcoinDonner(
  projectId: string,
  user: string
): Promise<{ result: boolean; error: string | null }> {
  try {
    if (!isValidAddress(user)) {
      return { result: false, error: 'Invalid address' }
    }
    const query = gql`{
    qfvotes(where: {projectId:"${projectId}", from:"${user}"}){
      id,
      from,
      to
    }
  }`

    const apiKeys = config.theGraphApis.split(',')
    const randomApiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)]
    const response = await request(
      `https://gateway.thegraph.com/api/${randomApiKey}/subgraphs/id/BQXTJRLZi7NWGq5AXzQQxvYNa5i1HmqALEJwy3gGJHCr`,
      query
    )
    return { result: response?.qfvotes.length != 0, error: null }
  } catch (error) {
    return { result: false, error: error }
  }
}

async function evaluatePUSHCondition(
  chatId: string | null,
  condition: Condition,
  userAddress: string,
  additionalRuleMeta?: AdditionalRuleMeta
): Promise<boolean> {
  const { category, subcategory, data } = condition

  switch (category) {
    case 'ERC721':
      switch (subcategory) {
        case 'holder':
          return await evaluateERC721NftOwner(data, userAddress)
        default:
          console.warn('Unknown subcategory:', subcategory)
          return false
      }
    case 'ERC20':
      switch (subcategory) {
        case 'holder':
          return await evaluateERC20TokenHolder(data, userAddress)
        default:
          console.warn('Unknown subcategory:', subcategory)
          return false
      }
    case 'CustomEndpoint':
      return await evaluateCustomEndpointCondition(condition, userAddress)
    case 'INVITE':
      if (subcategory === 'DEFAULT') {
        return await evaluateInviteCondition(chatId, data, userAddress, additionalRuleMeta)
      }
      console.warn('Unknown subcategory:', subcategory)
      return false
    default:
      console.warn('Unknown category:', category)
      return false
  }
}

async function evaluateInviteCondition(
  chatId: string | null,
  data: Data,
  userAddress: string,
  additionalRuleMeta?: AdditionalRuleMeta
): Promise<boolean> {
  if (!(additionalRuleMeta?.isAutoJoin ?? false)) {
    return true
  }
  if (!chatId) {
    return true
  }
  const chatMember = await w2wRepository.getMembersByAddresses(chatId, [userAddress])
  return chatMember.length === 1
}

async function evaluateERC721NftOwner(data: Data, userAddress: string): Promise<boolean> {
  const contractAddressCaip10 = data.contract
  const requiredAmount = ethers.BigNumber.from(data.amount)
  const numberNFTTokens = await numberOfNFTTokens(contractAddressCaip10, userAddress)

  if (numberNFTTokens.err) {
    console.error('Error:', numberNFTTokens.err, userAddress)
    return false
  }

  switch (data.comparison) {
    case '>':
      if (!numberNFTTokens.result.gt(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberNFTTokens.result} and not greater than ${requiredAmount}`
        )
        return false
      }
      break
    case '<':
      if (!numberNFTTokens.result.lt(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberNFTTokens.result} and not less than ${requiredAmount}`
        )
        return false
      }
      break
    case '>=':
      if (!numberNFTTokens.result.gte(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberNFTTokens.result} and not greater or equal to ${requiredAmount}`
        )
        return false
      }
      break
    case '<=':
      if (!numberNFTTokens.result.lte(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberNFTTokens.result} and not less or equal to ${requiredAmount}`
        )
        return false
      }
      break
    case '==':
      if (!numberNFTTokens.result.eq(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberNFTTokens.result} and not equal to ${requiredAmount}`
        )
        return false
      }
      break
    case '!=':
      if (numberNFTTokens.result.eq(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberNFTTokens.result} which is equal to ${requiredAmount}, expected not equal`
        )
        return false
      }
      break
    default: // If no comparison is provided, default to the original greater than check
      if (requiredAmount.gt(numberNFTTokens.result)) {
        console.error(
          `Address ${userAddress} has ${numberNFTTokens.result} and not ${requiredAmount}`
        )
        return false
      }
  }

  return true
}

async function evaluateERC20TokenHolder(data: Data, userAddress: string): Promise<boolean> {
  const contractAddressCaip10 = data.contract
  const requiredAmount = ethers.BigNumber.from(data.amount).mul(
    ethers.BigNumber.from(10).pow(data.decimals)
  )

  const numberERC20Tokens = await numberOfERC20Tokens(contractAddressCaip10, userAddress)

  if (numberERC20Tokens.err) {
    console.error('Error:', numberERC20Tokens.err, userAddress)
    return false
  }

  switch (data.comparison) {
    case '>':
      if (!numberERC20Tokens.result.gt(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberERC20Tokens.result} and not greater than ${requiredAmount}`
        )
        return false
      }
      break
    case '<':
      if (!numberERC20Tokens.result.lt(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberERC20Tokens.result} and not less than ${requiredAmount}`
        )
        return false
      }
      break
    case '>=':
      if (!numberERC20Tokens.result.gte(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberERC20Tokens.result} and not greater or equal to ${requiredAmount}`
        )
        return false
      }
      break
    case '<=':
      if (!numberERC20Tokens.result.lte(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberERC20Tokens.result} and not less or equal to ${requiredAmount}`
        )
        return false
      }
      break
    case '==':
      if (!numberERC20Tokens.result.eq(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberERC20Tokens.result} and not equal to ${requiredAmount}`
        )
        return false
      }
      break
    case '!=':
      if (numberERC20Tokens.result.eq(requiredAmount)) {
        console.error(
          `Address ${userAddress} has ${numberERC20Tokens.result} which is equal to ${requiredAmount}, expected not equal`
        )
        return false
      }
      break
    default: // If no comparison is provided, default to the original greater than check
      if (requiredAmount.gt(numberERC20Tokens.result)) {
        console.error(
          `Address ${userAddress} has ${numberERC20Tokens.result} and not ${requiredAmount}`
        )
        return false
      }
  }

  return true
}

async function evaluateGUILDCondition(condition: Condition, userAddress: string): Promise<boolean> {
  const { data } = condition

  // Use data.id for guildId based on the new format.
  let guildId = data.id

  // Converted userAddress to required format.
  const wallet = caip10ToWallet(userAddress)
  const redisKey = `guildResponse_${guildId}`

  try {
    // Attempt to retrieve guild response from cache
    let guildResponseData = await redisClient.get(redisKey)
    if (guildResponseData) {
      // Parse the string back into an object
      guildResponseData = JSON.parse(guildResponseData)
    } else {
      // Fetch from API and cache
      const guildResponse = await axios.get(`https://api.guild.xyz/v2/guilds/guild-page/${guildId}`)
      if (guildResponse.status !== 200 || !guildResponse.data) {
        console.error('Guild not found:', guildId)
        return false
      }
      guildResponseData = guildResponse.data
      // Cache the stringified guild response data
      await redisClient.set(redisKey, JSON.stringify(guildResponseData))
      await redisClient.expire(redisKey, 600)
    }

    // Proceed with the rest of your function using guildResponseData instead of guildResponse.data
    guildId = (guildResponseData as any).id

    const response = await axios.get(`https://api.guild.xyz/v1/guild/access/${guildId}/${wallet}`)
    const roles = response.data

    // If the role is specific, verify against data.role.
    if (data.role && data.role !== '*') {
      let roleId
      const roleFromId = (guildResponseData as any).roles.find((r) => r.id.toString() === data.role)
      const roleFromName = (guildResponseData as any).roles.find(
        (r) => r.name.toLowerCase() === data.role.toLowerCase()
      )

      if (roleFromId || roleFromName) {
        roleId = roleFromId ? roleFromId.id : roleFromName.id
      } else {
        console.error('Role not found:', data.role)
        return false
      }

      for (const role of roles) {
        if (role.roleId === roleId) {
          return role.access
        }
      }
    } else if (data.role === '*') {
      // If there's a wildcard role (*), then validate using the comparison property.
      switch (data.comparison) {
        case 'all':
          return roles.every((role) => role.access)
        case 'any':
          return roles.some((role) => role.access)
        default:
          console.error('Invalid comparison value:', data.comparison)
          return false
      }
    } else {
      console.error('Invalid role value:', data.role)
      return false
    }
  } catch (error) {
    console.error('Error evaluating GUILD condition:', error)
  }
  return false
}

async function evaluateCustomEndpointCondition(
  condition: Condition,
  userAddress: string
): Promise<boolean> {
  const { data } = condition

  const endpointUrl = data.url.replace('{{user_address}}', userAddress)

  try {
    let response
    switch (condition.subcategory) {
      case 'GET':
        response = await axios.get(endpointUrl, { timeout: 10000 })
        if (response.status === 200) {
          return true
        } else {
          console.error(`Received a ${response.status} response from the API.`)
          return false
        }
      default:
        throw new Error(`Unsupported HTTP method: ${condition.subcategory}`)
    }
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      // Axios timeout error code
      console.error('API request timed out:', error)
    } else {
      console.error('Error evaluating CUSTOM_ENDPOINT condition:', error)
    }
    return false
  }
}

async function evaluateIndividualCondition(
  chatId: string | null,
  condition: Condition,
  userAddress: string,
  additionalRuleMeta?: AdditionalRuleMeta
): Promise<boolean> {
  try {
    switch (condition.type) {
      case ConditionType.PUSH:
        return await evaluatePUSHCondition(chatId, condition, userAddress, additionalRuleMeta)
      case ConditionType.GUILD:
        return await evaluateGUILDCondition(condition, userAddress)
      default:
        console.warn('Unknown type:', condition.type)
        return false
    }
  } catch (error) {
    console.error('Error evaluating individual condition:', error)
    return false // Return false if an error occurred
  }
}

async function evaluateCondition(
  chatId: string | null,
  condition: Condition,
  userAddress: string,
  includeAccess: boolean,
  additionalRuleMeta?: AdditionalRuleMeta
): Promise<{ result: boolean; conditionsWithAccess: Condition }> {
  try {
    if (condition.any) {
      const results = await Promise.all(
        condition.any.map((subCondition: Condition) =>
          evaluateCondition(chatId, subCondition, userAddress, includeAccess, additionalRuleMeta)
        )
      )
      if (includeAccess) condition.any = results.map((r) => r.conditionsWithAccess) // Update with access flags
      return {
        result: results.some((result) => result.result === true),
        conditionsWithAccess: condition
      }
    }

    if (condition.all) {
      const results = await Promise.all(
        condition.all.map((subCondition: Condition) =>
          evaluateCondition(chatId, subCondition, userAddress, includeAccess, additionalRuleMeta)
        )
      )
      if (includeAccess) condition.all = results.map((r) => r.conditionsWithAccess) // Update with access flags
      return {
        result: results.every((result) => result.result === true),
        conditionsWithAccess: condition
      }
    }

    // Evaluate individual condition and set access flag
    const result = await evaluateIndividualCondition(
      chatId,
      condition,
      userAddress,
      additionalRuleMeta
    )
    if (includeAccess) condition.access = result
    return {
      result: result,
      conditionsWithAccess: condition
    }
  } catch (error) {
    console.error('An error occurred while evaluating the condition:', error)
    return { result: false, conditionsWithAccess: condition }
  }
}

// Helper function to validate member removal
export async function validateMemberRemoval(
  chatId: string,
  remove: string[]
): Promise<string | null> {
  if (remove.length > 0) {
    const existingMembers = await w2wRepository.getMembersByAddresses(chatId, remove)
    const existingMembersSet = new Set(
      existingMembers.map((member) => member.address.toLowerCase())
    )

    const invalidRemovals = remove.filter(
      (address) => !existingMembersSet.has(address.toLowerCase())
    )
    if (invalidRemovals.length > 0) {
      return `These members are not part of the group: ${invalidRemovals.join(', ')}`
    }
  }
  return null
}

export async function isAutoJoin(
  admins: string[],
  members: string[],
  remove: string[],
  signer: string
): Promise<boolean> {
  // AutoJoin is true only if there's exactly one member, no admins, no removals, and the member matches the signer
  const hasSingleMember = members.length === 1
  const hasNoAdmins = admins.length === 0
  const hasNoRemovals = remove.length === 0
  const memberIsSigner = members[0] === signer

  return hasSingleMember && hasNoAdmins && hasNoRemovals && memberIsSigner
}

export async function isAutoLeave(
  admins: string[],
  members: string[],
  remove: string[],
  signer: string
): Promise<boolean> {
  // AutoLeave is true only if there's exactly one member to be removed, no new members, no admins, and the removed member matches the signer
  const hasSingleRemoval = remove.length === 1
  const hasNoMembers = members.length === 0
  const hasNoAdmins = admins.length === 0
  const removalIsSigner = remove[0] === signer

  return hasSingleRemoval && hasNoMembers && hasNoAdmins && removalIsSigner
}

// Helper function to check for common elements among the sets
export function validateCommonElements(
  admins: string[],
  members: string[],
  remove: string[]
): string | null {
  const membersSet = new Set(members)
  const removeSet = new Set(remove)

  const commonWithAdminsAndMembers = new Set([...admins].filter((x) => membersSet.has(x)))
  const commonWithAdminsAndRemove = new Set([...admins].filter((x) => removeSet.has(x)))
  const commonWithMembersAndRemove = new Set([...members].filter((x) => removeSet.has(x)))

  if (
    commonWithAdminsAndMembers.size > 0 ||
    commonWithAdminsAndRemove.size > 0 ||
    commonWithMembersAndRemove.size > 0
  ) {
    return 'There should not be common elements among admins, members, and remove arrays'
  }

  return null
}

export function validateAddressFormats(
  admins: string[],
  members: string[],
  remove: string[]
): string | null {
  const isValidAddresses = (addresses: string[]) => addresses.every(isValidCAIP10Address)

  if (!isValidAddresses(admins)) {
    return 'Invalid address format in admins list'
  }
  if (!isValidAddresses(members)) {
    return 'Invalid address format in members list'
  }
  if (!isValidAddresses(remove)) {
    return 'Invalid address format in remove list'
  }

  return null
}

// Assuming `evaluateRules` is an async function that returns an object with an `entry` boolean property.
export async function checkAccessRulesForNewMembers(
  chatId: string,
  rules: any,
  newMembers: string[],
  additionalRuleMeta?: AdditionalRuleMeta
): Promise<string[]> {
  const deniedAccessMembers = []

  for (const member of newMembers) {
    if (rules && rules.entry) {
      const rulesResult = await evaluateRules(chatId, rules, member, false, additionalRuleMeta)
      if (!rulesResult.entry) {
        deniedAccessMembers.push(member)
      }
    }
  }

  return deniedAccessMembers
}

export async function evaluateRules(
  chatId: string | null, // null for create group flow
  rules: Rules,
  userAddress: string,
  includeAccess: boolean = false,
  additionalRuleMeta?: AdditionalRuleMeta
): Promise<{
  entry: boolean
  chat: boolean
  rules?: Rules
}> {
  let entryResult = true
  let chatResult = true

  let entryConditionsWithAccess: (Condition | ConditionBase) | (Condition | ConditionBase)[]
  let chatConditionsWithAccess: (Condition | ConditionBase) | (Condition | ConditionBase)[]

  if (Object.keys(rules).length > 0) {
    // Handle entry conditions
    if (rules.entry && rules.entry.conditions) {
      if (Array.isArray(rules.entry.conditions) && rules.entry.conditions.length > 0) {
        // Check if it's an array and has at least one element
        const result = await evaluateCondition(
          chatId,
          rules.entry.conditions[0],
          userAddress,
          includeAccess,
          additionalRuleMeta
        )
        entryResult = result.result
        entryConditionsWithAccess = [result.conditionsWithAccess]
      } else if (!Array.isArray(rules.entry.conditions)) {
        // If not an array, then it's a single Condition or ConditionBase object
        const result = await evaluateCondition(
          chatId,
          rules.entry.conditions,
          userAddress,
          includeAccess,
          additionalRuleMeta
        )
        entryResult = result.result
        entryConditionsWithAccess = result.conditionsWithAccess
      }
    }

    // Handle chat conditions
    if (rules.chat && rules.chat.conditions) {
      if (Array.isArray(rules.chat.conditions) && rules.chat.conditions.length > 0) {
        const result = await evaluateCondition(
          chatId,
          rules.chat.conditions[0],
          userAddress,
          includeAccess,
          additionalRuleMeta
        )
        chatResult = result.result
        chatConditionsWithAccess = [result.conditionsWithAccess]
      } else if (!Array.isArray(rules.chat.conditions)) {
        const result = await evaluateCondition(
          chatId,
          rules.chat.conditions,
          userAddress,
          includeAccess,
          additionalRuleMeta
        )
        chatResult = result.result
        chatConditionsWithAccess = result.conditionsWithAccess
      }
    }
  }

  if (includeAccess) {
    return {
      entry: entryResult,
      chat: chatResult,
      rules: {
        entry: { conditions: entryConditionsWithAccess },
        chat: { conditions: chatConditionsWithAccess }
      }
    }
  } else {
    return {
      entry: entryResult,
      chat: chatResult
    }
  }
}

async function validatePUSHData(condition: Condition): Promise<string[]> {
  const { type, category, subcategory } = condition

  switch (category) {
    case 'ERC721':
      return validateERC721Data(type, subcategory, condition.data)
    case 'ERC20':
      return validateERC20Data(type, subcategory, condition.data)
    case 'CustomEndpoint':
      return validateCustomEndpointData(type, subcategory, condition.data)
    case 'INVITE':
      return validateInviteData(type, subcategory, condition.data)
    default:
      return [`Type: ${type}, Category: ${category} - Unknown category`]
  }
}

async function validateInviteData(
  type: string,
  subcategory: string,
  data: Data
): Promise<string[]> {
  const errors: string[] = []

  switch (subcategory) {
    case 'DEFAULT':
      if (!data.inviterRoles || data.inviterRoles.length === 0) {
        errors.push(
          `Type: ${type}, Category: INVITE, Subcategory: ${subcategory} - Missing or empty inviterRoles`
        )
      } else {
        const validRoles = ['ADMIN', 'OWNER']
        const invalidRoles = data.inviterRoles.filter((role) => !validRoles.includes(role))
        if (invalidRoles.length > 0) {
          errors.push(
            `Type: ${type}, Category: INVITE, Subcategory: ${subcategory} - Invalid roles in inviterRoles: ${invalidRoles.join(
              ', '
            )}`
          )
        }
      }
      break
    default:
      errors.push(
        `Type: ${type}, Category: INVITE, Subcategory: ${subcategory} - Unknown subcategory`
      )
  }

  return errors
}

async function validateERC721Data(
  type: string,
  subcategory: string,
  data: Data
): Promise<string[]> {
  const errors: string[] = []

  switch (subcategory) {
    case 'holder':
      if (!data.contract) {
        errors.push(
          `Type: ${type}, Category: ERC721, Subcategory: ${subcategory} - Address is missing`
        )
      } else {
        if (!isValidActualCAIP10Address(data.contract)) {
          errors.push(
            `Type: ${type}, Category: ERC721, Subcategory: ${subcategory} - Contract : ${data.contract} Invalid Contract Address ERC721`
          )
        }
      }
      if (data.amount === undefined || data.amount === null) {
        errors.push(
          `Type: ${type}, Category: ERC721, Subcategory: ${subcategory} - Amount is missing`
        )
      } else if (data.amount <= 0) {
        errors.push(
          `Type: ${type}, Category: ERC721, Subcategory: ${subcategory} - Amount should be greater than 0`
        )
      }
      break
    default:
      errors.push(
        `Type: ${type}, Category: ERC721, Subcategory: ${subcategory} - Unknown subcategory`
      )
  }

  return errors
}

async function validateERC20Data(type: string, subcategory: string, data: Data): Promise<string[]> {
  const errors: string[] = []

  switch (subcategory) {
    case 'holder':
      if (!data.contract) {
        errors.push(
          `Type: ${type}, Category: ERC20, Subcategory: ${subcategory} - Contract is missing`
        )
      } else {
        if (!isValidActualCAIP10Address(data.contract)) {
          errors.push(
            `Type: ${type}, Category: ERC20, Subcategory: ${subcategory} - Contract : ${data.contract} Invalid Contract Address ERC20`
          )
        }
      }
      if (data.amount === undefined || data.amount === null) {
        errors.push(
          `Type: ${type}, Category: ERC20, Subcategory: ${subcategory} - Amount is missing`
        )
      } else if (data.amount <= 0) {
        errors.push(
          `Type: ${type}, Category: ERC20, Subcategory: ${subcategory} - Amount should be greater than 0`
        )
      }
      if (data.decimals === undefined || data.decimals === null) {
        errors.push(
          `Type: ${type}, Category: ERC20, Subcategory: ${subcategory} - Decimals is missing`
        )
      }
      break
    default:
      errors.push(
        `Type: ${type}, Category: ERC20, Subcategory: ${subcategory} - Unknown subcategory`
      )
  }

  return errors
}

async function validateCustomEndpointData(
  type: string,
  subcategory: string,
  data: Data
): Promise<string[]> {
  const errors: string[] = []

  if (!data.url) {
    errors.push(`Type: ${type}, Category: PUSH, Subcategory: ${subcategory} - URL is missing`)
  } else {
    // Protocol Validation
    if (!data.url.startsWith('http://') && !data.url.startsWith('https://')) {
      errors.push(
        `Type: ${type}, Category: PUSH, Subcategory: ${subcategory} - Invalid URL protocol. Only "http://" and "https://" are allowed.`
      )
    }

    // URL Length Check
    if (data.url.length > 2083) {
      errors.push(`Type: ${type}, Category: PUSH, Subcategory: ${subcategory} - URL is too long.`)
    }

    // Check for GET and Template
    if (subcategory === 'GET') {
      if (!data.url.includes('{{user_address}}')) {
        errors.push(
          `Type: ${type}, Category: PUSH, Subcategory: ${subcategory} - GET request URL should have the '{{user_address}}' template.`
        )
      }

      // Ensure proper number of expected templates
      const matches = data.url.match(/{{user_address}}/g) || []
      if (matches.length > 1) {
        errors.push(
          `Type: ${type}, Category: PUSH, Subcategory: ${subcategory} - GET request URL should not have multiple '{{user_address}}' templates.`
        )
      }
    }
  }

  if (errors.length === 0 && subcategory !== 'GET') {
    errors.push(`Type: ${type}, Category: PUSH, Subcategory: ${subcategory} - Unknown subcategory`)
  }

  return errors
}

async function validateGUILDData(condition: Condition): Promise<string[]> {
  const { data } = condition
  const errors: string[] = []

  // Validate the category
  if (condition.category !== 'ROLES') {
    errors.push('Invalid category value')
    return errors
  }

  // Check for guild ID presence
  if (!data.id) {
    errors.push('Guild ID is missing')
  } else {
    try {
      const response = await axios.get(`https://api.guild.xyz/v2/guilds/guild-page/${data.id}`)

      if (response.status !== 200) {
        errors.push('Invalid Guild ID')
      } else {
        if (condition.subcategory !== 'DEFAULT') {
          errors.push('Invalid subcategory value')
          return errors
        }

        // Validate the role values
        if (data.role === '*') {
          if (data.comparison !== 'all' && data.comparison !== 'any') {
            errors.push('Invalid comparison value')
          }
        } else if (data.role) {
          const roleExists = response.data.roles.some(
            (role: { id: number; name: string }) =>
              role.id.toString() === data.role ||
              (role.name && role.name.toLowerCase() === data.role.toLowerCase())
          )
          if (!roleExists) {
            errors.push('Invalid Guild Role ID')
          }

          // For specific role, comparison can be null or empty
          if (data.comparison) {
            errors.push('Comparison should be empty for specific role')
          }
        } else {
          errors.push('Invalid role value')
        }
      }
    } catch (error) {
      errors.push('Error validating Guild ID')
    }
  }

  return errors
}

async function validateIndividualCondition(condition: Condition): Promise<string[]> {
  const errors: string[] = []
  if (!condition.type) {
    errors.push('Type is missing')
  } else {
    switch (condition.type) {
      case ConditionType.PUSH:
        return await validatePUSHData(condition)
      case ConditionType.GUILD:
        return await validateGUILDData(condition)
      default:
        errors.push(`Unknown type: ${condition.type}`)
    }
  }
  return errors
}

export async function validateRules(rules: Rules): Promise<string[]> {
  let errors: string[] = []

  // Validate the top-level properties
  for (const key of Object.keys(rules)) {
    if (key !== 'entry' && key !== 'chat') {
      errors.push(`Unexpected property: ${key}`)
      continue // Skip unexpected keys
    }

    const conditions = rules[key]?.conditions

    if (conditions) {
      // Check if INVITE category is used within chat rules
      if (key === 'chat') {
        if (Array.isArray(conditions) && conditions.some((cond) => cond.category === 'INVITE')) {
          errors.push(`INVITE category is not allowed for chat rules`)
        } else if (!Array.isArray(conditions) && conditions.category === 'INVITE') {
          errors.push(`INVITE category is not allowed for chat rules`)
        }
      }

      if (Array.isArray(conditions)) {
        const conditionErrors = (await Promise.all(conditions.map(validateCondition))).reduce(
          (acc, val) => acc.concat(val),
          []
        )
        errors = errors.concat(conditionErrors)
      } else {
        // Handle single object case (Condition or ConditionBase)
        const conditionError = await validateCondition(conditions as Condition)
        errors = errors.concat(conditionError)
      }
    }
  }

  return errors
}

export async function validateCondition(condition: Condition | ConditionBase): Promise<string[]> {
  let errors: string[] = []
  const expectedKeys = ['type', 'category', 'subcategory', 'data', 'any', 'all', 'access']

  // Check for unexpected properties
  for (const key of Object.keys(condition)) {
    if (!expectedKeys.includes(key)) {
      errors.push(`Unexpected property in Condition: ${key}`)
    }
  }

  const validateSubConditions = async (
    subConditions: (Condition | ConditionBase)[]
  ): Promise<string[]> => {
    const subErrors = (await Promise.all(subConditions.map(validateCondition))).reduce(
      (acc, val) => acc.concat(val),
      []
    )
    return subErrors
  }

  function isComplexCondition(condition: Condition | ConditionBase): condition is Condition {
    return !!(condition as Condition).any || !!(condition as Condition).all
  }

  // Validate 'any' conditions
  if (isComplexCondition(condition) && condition.any) {
    errors = [...errors, ...(await validateSubConditions(condition.any))]
  }

  // Validate 'all' conditions
  if (isComplexCondition(condition) && condition.all) {
    errors = [...errors, ...(await validateSubConditions(condition.all))]
  }

  // Validate individual condition if there's no 'any' or 'all'
  if (!isComplexCondition(condition)) {
    const individualErrors = await validateIndividualCondition(condition)
    errors = [...errors, ...individualErrors]
  }

  return errors
}
