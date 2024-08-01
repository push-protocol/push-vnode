import chai from 'chai'
import chaiHttp from 'chai-http'
import 'mocha'
import { Container } from 'typedi'
import { startServer, stopServer } from '../../../src/appInit'
import channelsClass from '../../../src/services/channelsCompositeClasses/channelsClass'
const BLOCKCHAIN_TYPE: Array<String> = ['ETH_TEST_KOVAN', 'POLYGON_TEST_MUMBAI']

var uuid = require('uuid')

chai.use(chaiHttp)
chai.should()
const expect = chai.expect

describe.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass test', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: getChannel test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      const response = await channelClass.getChannel(channel)
      expect(response.channel).to.be.equals(channel)
    } catch (err) {
      console.error('🔥  error in getChannel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: getChannel with no data test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      const response = await channelClass.getChannel(channel)
      expect(response).to.be.equals(null)
    } catch (err) {
      console.error('🔥  error in getChannel with no data test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: addChannel test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      const response = await channelClass.addChannel(channel, channelType, identity)
      expect(response.affectedRows).to.be.equals(1)
      const getChannelResponse = await channelClass.getChannel(channel)
      expect(getChannelResponse.channel).to.be.equals(channel)
    } catch (err) {
      console.error('🔥  error in addChannel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: _deleteChannel test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass._deleteChannel(channel, identity)
      const response = await channelClass.getChannel(channel)
      expect(response).to.be.equals(null)
    } catch (err) {
      console.error('🔥  error in _deleteChannel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: updateChannel test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      const response = await channelClass.getChannel(channel)
      const newIdentity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714752'

      await channelClass.updateChannel(channel, newIdentity)
      const updateChannelResponse = await channelClass.getChannel(channel)
      expect(response.ipfshash).to.be.not.equals(updateChannelResponse.ipfshash)
    } catch (err) {
      console.error('🔥  error in updateChannel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass.updateChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: _populateChannelData test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
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
      const response = await channelClass.getChannel(channel)
      expect(response.name).to.be.equals(channel_name)
      expect(response.info).to.be.equals(channel_info)
      expect(response.url).to.be.equals(channel_url)
      expect(response.icon).to.be.equals(channel_icon)
      expect(response.channel).to.be.equals(channel)
    } catch (err) {
      console.error('🔥  error in _populateChannelData test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: bumpAttemptCount test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
    const channelType = 2

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass._bumpAttemptCount(channel)
      const response = await channelClass.getChannel(channel)
      expect(response.attempts).to.be.equals(1)
    } catch (err) {
      console.error('🔥  error in bumpAttemptCount test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: getChannels test', async function () {
    const channelClass = Container.get(channelsClass)
    const pageSize = 10
    try {
      const response = await channelClass.getChannels(1, pageSize)
      expect(response).to.have.any.keys('count')
      expect(response).to.have.any.keys('results')
      expect(response.results).to.be.an('array')
      expect(response.results.length).to.be.lessThanOrEqual(pageSize)
    } catch (err) {
      console.error('🔥  error in getChannels test: %s', err)
      expect(err).to.be.null
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: getChannels with no data test', async function () {
    const channelClass = Container.get(channelsClass)
    const pageSize = 10
    const pageNum = 1000000000 // large number
    try {
      const response = await channelClass.getChannels(pageNum, pageSize)
      expect(response).to.have.any.keys('count')
      expect(response).to.have.any.keys('results')
      expect(response.results).to.be.an('array')
      expect(response.results.length).to.be.equals(0)
    } catch (err) {
      console.error('🔥  error in getChannels with no data test: %s', err)
      expect(err).to.be.null
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: setChannelActivationStatus test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    const activationStatus = 1
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass.setChannelActivationStatus(channel, activationStatus)
      const response = await channelClass.getChannel(channel)
      expect(response.activation_status).to.be.equals(1)
    } catch (err) {
      console.error('🔥  error in setChannelActivationStatus test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: setChannelBlockedStatus test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass.setChannelBlockedStatus(channel)
      const response = await channelClass.getChannel(channel)
      expect(response.activation_status).to.be.equals(1)
    } catch (err) {
      console.error('🔥  error in setChannelBlockedStatus test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: isChannelBlocked test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass.setChannelBlockedStatus(channel)
      const response = await channelClass.isChannelBlocked(channel)
      expect(response).to.have.any.keys('success')
      expect(response).to.have.any.keys('status')
      expect(response.status).to.be.equals(true)
      expect(response.success).to.be.equals(true)
    } catch (err) {
      console.error('🔥  error in isChannelBlocked test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: setDelegateeAddress test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const delegate = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])
      const response = await channelClass.setDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])

      expect(response).to.have.any.keys('channelAddress')
      expect(response).to.have.any.keys('delegateeAddress')
      expect(response.channelAddress).to.be.equals(channel)
      expect(response.delegateeAddress).to.be.equals(delegate)
    } catch (err) {
      console.error('🔥  error in setDelegateeAddress test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: removeDelegateeAddress test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const delegate = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])
      await channelClass.setDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])
      const response = await channelClass.removeDelegateeAddress(
        channel,
        delegate,
        BLOCKCHAIN_TYPE[0]
      )
      expect(response).to.have.any.keys('channelAddress')
      expect(response).to.have.any.keys('delegateeAddress')
      expect(response.channelAddress).to.be.equals(channel)
      expect(response.delegateeAddress).to.be.equals(delegate)
    } catch (err) {
      console.error('🔥  error in removeDelegateeAddress test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: getDelegateFromChannel test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const delegate = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])
      await channelClass.setDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])
      const response = await channelClass.getDelegateFromChannel(channel, BLOCKCHAIN_TYPE[0])
      expect(response).to.have.any.keys('delegateAddress')
      expect(response.delegateAddress).to.be.an('array')
      expect(response.delegateAddress).to.contain(delegate.toLowerCase())
    } catch (err) {
      console.error('🔥  error in getDelegateFromChannel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: getChannelOwnersFromDelegate test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const delegate = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])
      await channelClass.setDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])
      const response = await channelClass.getChannelOwnersFromDelegate(delegate, BLOCKCHAIN_TYPE[0])
      expect(response).to.have.any.keys('channelOwners')
      expect(response).to.have.any.keys('length')
      expect(response.channelOwners).to.contain(channel)
    } catch (err) {
      console.error('🔥  error in getChannelOwnersFromDelegate test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN_TYPE[0])
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: verifyChannel test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      const responseBeforeVeify = await channelClass.getChannel(channel)
      expect(responseBeforeVeify.verified_status).to.be.equals(0)
      await channelClass.verifyChannel(channel)
      const response = await channelClass.getChannel(channel)
      expect(response.channel).to.be.equals(channel)
      expect(response.verified_status).to.be.equals(1)
    } catch (err) {
      console.error('🔥  error in verifyChannel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: _verifyChannelAlias test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      const responseBeforeVeify = await channelClass.getChannel(channel)
      expect(responseBeforeVeify.is_alias_verified).to.be.equals(0)
      await channelClass._verifyChannelAlias(channel)
      const response = await channelClass.getChannel(channel)
      expect(response.channel).to.be.equals(channel)
      expect(response.is_alias_verified).to.be.equals(1)
    } catch (err) {
      console.error('🔥  error in _verifyChannelAlias test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: unVerifyChannel test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const channelClass = Container.get(channelsClass)

    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      const responseBeforeVeify = await channelClass.getChannel(channel)
      expect(responseBeforeVeify.verified_status).to.be.equals(0)
      await channelClass.verifyChannel(channel)
      const response = await channelClass.getChannel(channel)
      expect(response.channel).to.be.equals(channel)
      expect(response.verified_status).to.be.equals(1)
      await channelClass.unVerifyChannel(channel)
      const responseAfterVerify = await channelClass.getChannel(channel)
      expect(responseAfterVerify.channel).to.be.equals(channel)
      expect(responseAfterVerify.verified_status).to.be.equals(0)
    } catch (err) {
      console.error('🔥  error in unVerifyChannel test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: getEthChannelFromAliasAddress test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
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
      const response = await channelClass.getEthChannelFromAliasAddress(aliasAddress)
      expect(response).to.have.any.keys('ethAddress')
      expect(response.ethAddress).to.be.equals(channel)
    } catch (err) {
      console.error('🔥  error in getEthChannelFromAliasAddress test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: getAllSubGraphDetails test', async function () {
    const channelClass = Container.get(channelsClass)
    const pageSize = 10
    const pageNum = 1000000000 // large number
    try {
      const response = await channelClass.getAllSubGraphDetails()
      expect(response).to.have.any.keys('status')
      expect(response).to.have.any.keys('result')
      expect(response.result).to.be.an('array')
    } catch (err) {
      console.error('🔥  error in getAllSubGraphDetails test: %s', err)
      expect(err).to.be.null
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: getSubgraphRetires test', async function () {
    const channel = 'eip155:5:0x8F8b22A38CC33b5B4Ad57b66fF1e998B0e5ad1e7'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'
    const aliasAddress = 'eip155:80001:0x8F8b22A38CC33b5B4Ad57b66fF1e998B0e5ad1e7'
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
      await channelClass.addSubGraphDetails(
        channel,
        '0x36302b737472796b6572696e2f6d792d7375626772617068'
      )
      const response = await channelClass.getSubgraphRetires(channel)
      expect(response).to.have.any.keys('status')
      expect(response.status).to.be.true
      expect(response.result).to.be.equal(0)
    } catch (err) {
      console.error('🔥  error in getEthChannelFromAliasAddress test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: updateSubgraphDetails test', async function () {
    const channel = 'eip155:5:0x8F8b22A38CC33b5B4Ad57b66fF1e998B0e5ad1e7'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'
    const aliasAddress = 'eip155:80001:0x8F8b22A38CC33b5B4Ad57b66fF1e998B0e5ad1e7'
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
      await channelClass.addSubGraphDetails(
        channel,
        '0x36302b737472796b6572696e2f6d792d7375626772617068'
      )

      const response = await channelClass.updateSubgraphDetails(channel, 'abcd', '1')
      expect(response).to.have.any.keys('status')
      expect(response.status).to.be.false
    } catch (err) {
      console.error('🔥  error in getEthChannelFromAliasAddress test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: updateSubgraphDetails test', async function () {
    const channel = 'eip155:5:0x8F8b22A38CC33b5B4Ad57b66fF1e998B0e5ad1e7'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'
    const aliasAddress = 'eip155:80001:0x8F8b22A38CC33b5B4Ad57b66fF1e998B0e5ad1e7'
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
      await channelClass.addSubGraphDetails(
        channel,
        '0x36302b737472796b6572696e2f6d792d7375626772617068'
      )

      const response = await channelClass.updateSubgraphDetails(channel, 'subgraph_details', '123')
      expect(response).to.have.any.keys('status')
      expect(response.status).to.be.true
      const channelDetails = await channelClass.getChannel(channel)
      expect(channelDetails.subgraph_details).to.be.equal('123')
    } catch (err) {
      console.error('🔥  error in getEthChannelFromAliasAddress test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass :: updateSubgraphDetails test', async function () {
    const channel = 'eip155:5:0x8F8b22A38CC33b5B4Ad57b66fF1e998B0e5ad1e7'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelClass = Container.get(channelsClass)
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'
    const aliasAddress = 'eip155:80001:0x8F8b22A38CC33b5B4Ad57b66fF1e998B0e5ad1e7'
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
      await channelClass.addSubGraphDetails(
        channel,
        '0x36302b737472796b6572696e2f6d792d7375626772617068'
      )

      const response = await channelClass.updateSubgraphDetails(channel, 'subgraph_attempts', '')
      expect(response).to.have.any.keys('status')
      expect(response.status).to.be.true
      const channelDetails = await channelClass.getChannel(channel)
      expect(channelDetails.subgraph_attempts).to.be.equal(1)
    } catch (err) {
      console.error('🔥  error in getEthChannelFromAliasAddress test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  describe('processChannelData', async () => {
    it('Should process the channel data', async () => {
      const channelClass = Container.get(channelsClass)
      const res = await channelClass.processChannelData(
        'eip155:11155111:0x24E9a586825cC3E7A564356143EbC0cF15b64fa5',
        'Qmcb8EqwhJTYgwCxEnqq2RfVYjwMfitLX1MjR1suhKxL9R'
      )
    })
  })
})
