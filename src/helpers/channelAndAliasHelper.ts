import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../config'
import { convertCaipToObject, isValidCAIP10Address } from '../helpers/caipHelper'
import Alias from '../services/channelsCompositeClasses/aliasClass'
import Channel from '../services/channelsCompositeClasses/channelsClass'

export const ingestChannelAliasAddress = async (
  alias: Alias,
  caipType: string,
  ownerAddress: string,
  ethChannelAddress: string,
  initiateTxHash: string
): Promise<void> => {
  const logger: Logger = Container.get('logger')
  const channels = Container.get(Channel)

  try {
    let channelAddress
    if (!isValidCAIP10Address(ethChannelAddress)) {
      // if not valid caip10 address, its in older format and needs to fallback to eth
      channelAddress = `${config.ethereumId}:${ownerAddress}`
      ethChannelAddress = `${caipType}:${ethChannelAddress}`
    } else {
      channelAddress = `${caipType}:${ownerAddress}`
    }
    const channelDetails = await channels.getChannel(channelAddress)

    if (channelDetails && isValidCAIP10Address(ethChannelAddress)) {
      const channelChainId = convertCaipToObject(channelDetails.channel).result.chainId
      const aliasChainId = convertCaipToObject(ethChannelAddress).result.chainId

      if (channelChainId !== aliasChainId) {
        logger.info(
          `Channel Exists and chains are not same, updating alias address for channel ${channelDetails.channel}`
        )
        await alias.updateChannelAliasAddress(
          channelDetails.channel,
          ethChannelAddress,
          initiateTxHash
        )
      }
    } else {
      logger.info(`Channel does not exists or alias address is not in valid format .`)
    }
  } catch (err) {
    logger.error(`Error in updating alias address for channel ${err}`)
  }
}
