import 'mocha'

import chai from 'chai'
import chaiHttp from 'chai-http'
import { Container } from 'typedi'

import { startServer, stopServer } from '../../src/appInit'
import config from '../../src/config'
import channelsClass from '../../src/services/channelsCompositeClasses/channelsClass'
import channelsService from '../../src/services/channelsService'
const ETH_CAIP = config.ethereumId
const uuid = require('uuid')

chai.use(chaiHttp)
chai.should()
const expect = chai.expect

describe('api/services/channelsService :: channelsService test', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  it('api/helpers/channelsService :: channelsService :: subscribe test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'
    const channelClass = Container.get(channelsClass)
    const channelService = Container.get(channelsService)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      const response = await channelService.subscribe(channel, subscriber, BLOCKCHAIN)
      expect(response).to.be.equals(true)
    } catch (err) {
      console.error('🔥  error in subscribe to channel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it('api/helpers/channelsService :: channelsService :: unsubscribe test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'
    const channelClass = Container.get(channelsClass)
    const channelService = Container.get(channelsService)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelService.subscribe(channel, subscriber, BLOCKCHAIN)
      const response = await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
      expect(response).to.be.equals(true)
    } catch (err) {
      console.error('🔥  error in unsubscribe to channel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it('api/helpers/channelsService :: channelsService :: getChannels test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2

    const page = 1
    const pageSize = 10
    const blockchain = 42
    const channelService = Container.get(channelsService)
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      const response = await channelService.getChannels(channel, page, pageSize, blockchain)
      expect(response).not.to.be.null
      expect(response).to.have.any.keys('channelsDetail')
      expect(response).to.have.any.keys('count')
      expect(response.channelsDetail).to.be.an('array')
      expect(response.count).to.be.an('number')
      expect(response.count).to.be.greaterThanOrEqual(0)
    } catch (err) {
      console.error('🔥  error in getChannelsWithSub to channel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it('api/helpers/channelsService :: channelsService :: searchChannelDetail test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'
    const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1'
    const channelName = uuid.v4()

    const page = 1
    const pageSize = 10
    const blockchain = 42
    const channelService = Container.get(channelsService)
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass._populateChannelData(
        channel,
        channelName,
        'channel_info',
        'channel_url',
        'channel_icon',
        aliasAddress,
        BLOCKCHAIN
      )
      const response = await channelService.searchChannelDetail(
        channelName,
        channel,
        blockchain,
        page,
        pageSize
      )

      expect(response).not.to.be.null
      expect(response).to.have.any.keys('channels')
      expect(response).to.have.any.keys('count')
      expect(response.channels).to.be.an('array')
      expect(response.count).to.be.an('number')
      expect(response.count).to.be.greaterThanOrEqual(1)
    } catch (err) {
      console.error('🔥  error in searchChannelDetail test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it('api/helpers/channelsService :: channelsService :: searchChannelDetail test with unknown query', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'
    const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1'
    const channelName = uuid.v4()

    const page = 1
    const pageSize = 10
    const blockchain = 42
    const channelService = Container.get(channelsService)
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass._populateChannelData(
        channel,
        channelName,
        'channel_info',
        'channel_url',
        'channel_icon',
        aliasAddress,
        BLOCKCHAIN
      )
      const new_query = uuid.v4()
      const response = await channelService.searchChannelDetail(
        new_query,
        channel,
        blockchain,
        page,
        pageSize
      )

      expect(response).not.to.be.null
      expect(response).to.have.any.keys('channels')
      expect(response).to.have.any.keys('count')
      expect(response.channels).to.be.an('array')
      expect(response.count).to.be.an('number')
      expect(response.count).to.be.equal(0)
    } catch (err) {
      console.error('🔥  error in searchChannelDetail test with unknown query test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it('api/helpers/channelsService :: channelsService :: addChannel test', async function () {
    const channelClass = Container.get(channelsClass)
    const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channel_name = 'channel_name'
    const channel_info = 'channel_info'
    const channel_url = 'channel_url'
    const channel_icon = 'channel_icon'
    const channelType = 2
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass._populateChannelData(
        channel,
        channel_name,
        channel_info,
        channel_url,
        channel_icon,
        '',
        null,
        null
      )
    } catch (err) {
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })
})
