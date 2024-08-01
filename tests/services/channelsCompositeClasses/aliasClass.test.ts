import chai from 'chai'
import chaiHttp from 'chai-http'
import 'mocha'
import { Container } from 'typedi'
import { startServer, stopServer } from '../../../src/appInit'
import aliasClass from '../../../src/services/channelsCompositeClasses/aliasClass'
import channelsClass from '../../../src/services/channelsCompositeClasses/channelsClass'
const BLOCKCHAIN_TYPE: Array<String> = ['ETH_TEST_KOVAN', 'POLYGON_TEST_MUMBAI']

chai.use(chaiHttp)
chai.should()
const expect = chai.expect

describe.skip('api/services/channelscompositeClasses/aliasClass :: aliasClass test', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  it('api/services/channelscompositeClasses/aliasClass :: aliasClass :: isAliasVerified test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const alias = Container.get(aliasClass)
    const channelType = 2
    const channelClass = Container.get(channelsClass)
    const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1'
    const channel_name = 'channel_name'
    const channel_info = 'channel_info'
    const channel_url = 'channel_url'
    const channel_icon = 'channel_icon'
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass._populateChannelData(
        channel,
        channel_name,
        channel_info,
        channel_url,
        channel_icon,
        aliasAddress,
        BLOCKCHAIN
      )

      await channelClass._verifyChannelAlias(channel)

      const response = await alias.isAliasVerified(aliasAddress)
      expect(response).to.have.any.keys('success')
      expect(response).to.have.any.keys('status')
      expect(response.status).to.be.equals(true)
      expect(response.success).to.be.equals(true)
    } catch (err) {
      console.error('🔥  error in isAliasVerified test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it('api/services/channelscompositeClasses/aliasClass :: aliasClass :: isAliasVerified negative test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const alias = Container.get(aliasClass)
    const channelType = 2
    const channelClass = Container.get(channelsClass)
    const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1'
    const channel_name = 'channel_name'
    const channel_info = 'channel_info'
    const channel_url = 'channel_url'
    const channel_icon = 'channel_icon'
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass._populateChannelData(
        channel,
        channel_name,
        channel_info,
        channel_url,
        channel_icon,
        aliasAddress,
        BLOCKCHAIN
      )

      const response = await alias.isAliasVerified(aliasAddress)
      expect(response).to.have.any.keys('success')
      expect(response).to.have.any.keys('status')
      expect(response.status).to.be.equals(false)
      expect(response.success).to.be.equals(true)
    } catch (err) {
      console.error('🔥  error in isAliasVerified negative test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it('api/services/channelscompositeClasses/channelsClass :: channelsClass :: getAliasFromEthChannel test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
    const alias = Container.get(aliasClass)
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'
    const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1'
    const channel_name = 'channel_name'
    const channel_info = 'channel_info'
    const channel_url = 'channel_url'
    const channel_icon = 'channel_icon'

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass._populateChannelData(
        channel,
        channel_name,
        channel_info,
        channel_url,
        channel_icon,
        aliasAddress,
        BLOCKCHAIN
      )
      await alias.getAliasFromEthChannel(channel)
      const response = await channelClass.getChannel(channel)
      expect(response.channel).to.be.equals(channel)
    } catch (err) {
      console.error('🔥  error in getAliasFromEthChannel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it('api/services/channelscompositeClasses/channelsClass :: channelsClass :: checkAndUpdateAlias test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
    const alias = Container.get(aliasClass)
    const channelType = 2
    const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1'
    const chainId = 42
    const aliasEvent = {
      aliasAddress: aliasAddress,
      aliasBlockchainId: chainId
    }
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await alias.checkAndUpdateAlias(channel, aliasAddress, chainId)
      const response = await channelClass.getChannel(channel)
      expect(response.alias_verification_event).not.to.be.equals(null)
      const event = JSON.parse(response.alias_verification_event)
      expect(event.aliasAddress).to.be.equals(aliasAddress)
      expect(event.aliasBlockchainId).to.be.equals(chainId)
    } catch (err) {
      console.error('🔥  error in checkAndUpdateAlias test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })
})
