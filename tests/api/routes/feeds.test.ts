import chai from 'chai'
import chaiHttp from 'chai-http'
import 'mocha'
import { Container } from 'typedi'
import { startServer, stopServer } from '../../../src/appInit'
const axios = require('axios').default
import FeedsService from '../../../src/services/feedsService'

chai.use(chaiHttp)
chai.should()
const expect = chai.expect
var uuid = require('uuid')

import channelsClass from '../../../src/services/channelsCompositeClasses/channelsClass'
import channelsService from '../../../src/services/channelsService'

const FEED_BASE_URL = 'http://[::1]:4000/apis/feeds'

const prepared_payload = {
  apns: {
    payload: {
      aps: {
        category: 'withappicon',
        'mutable-content': 1,
        'content-available': 1
      }
    },
    fcm_options: {
      image: 'localhost:4000/cache/QmX79JzeMHHThELmDJ6WFLGA6W5mmqSRMDYtYoKxuEz2SM.png'
    }
  },
  data: {
    app: 'AAVE',
    url: '',
    acta: 'http://beta.myenscrypto.com',
    aimg: '',
    amsg: '[d:ENS] domains from 2017 that have expired.\n\nGo check your @ensdomains right now by adding your accounts to.',
    asub: 'Your ENS Domain has expired and someone is about to get their hands on them',
    icon: 'localhost:4000/cache/QmX79JzeMHHThELmDJ6WFLGA6W5mmqSRMDYtYoKxuEz2SM.png',
    type: 1,
    appbot: '0',
    hidden: '0',
    secret: ''
  },
  notification: {
    body: 'ENS domains from 2017 that have expired',
    title: 'AAVE - Hey You!! Your ENS Domain expired'
  }
}

describe.skip('TEST CASES - api/routes/feeds :: feeds test', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  it('api/routes/feeds :: /apis/feeds/add :: add new feed test', async function () {
    const payload_id = '1'
    const payload = {
      payload_id: payload_id,
      channel: '0x52542b1fc37e6aae19ab23881fab71e818389adf',
      users: ['0x52542b1fc37e6aae19ab23881fab71e818389adf'],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN',
      is_spam: 0
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)
    try {
      const response = await axios.post(FEED_BASE_URL + '/add', payload)
      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data).to.include({
        success: 1
      })
    } catch (err) {
      console.error('🔥  error in add feed test: %s', err)
      expect(err).to.be.null
    } finally {
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/get_feeds ::  get feeds test ', async function () {
    const payload_id = 1
    const user_id = uuid.v4()
    const payload = {
      payload_id: payload_id,
      channel: '0x52542b1fc37e6aae19ab23881fab71e818389adf',
      users: [user_id],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN',
      is_spam: 0
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)

    await feeds.addFeed(
      payload['payload_id'],
      payload['channel'],
      payload['users'],
      payload['prepared_payload'],
      payload['blockchain'],
      payload['is_spam']
    )

    try {
      const response = await axios.post(FEED_BASE_URL + '/get_feeds', {
        user: user_id,
        page: 1,
        pageSize: 10,
        op: 'read'
      })

      console.log(response.data)
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.greaterThanOrEqual(1)
      expect(response.data.results[0].payload_id).to.equals(payload_id)
    } catch (err) {
      console.error('🔥  error in get feeds test: %s', err)
      expect(err).to.be.null
    } finally {
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/get_feeds ::  get feeds test with empty results', async function () {
    const payload_id = 1
    const user_id = uuid.v4()
    const feeds = Container.get(FeedsService)
    try {
      const response = await axios.post(FEED_BASE_URL + '/get_feeds', {
        user: user_id,
        page: 1,
        pageSize: 10,
        op: 'read'
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.equal(0)
    } catch (err) {
      console.error('🔥  error in get feeds test with empty results: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/feeds :: /apis/feeds/get_spam_feeds ::  get spam feeds test ', async function () {
    const payload_id = 1
    const user_id = uuid.v4()
    const payload = {
      payload_id: payload_id,
      channel: '0x52542b1fc37e6aae19ab23881fab71e818389adf',
      users: [user_id],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN',
      is_spam: 1
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)

    await feeds.addFeed(
      payload['payload_id'],
      payload['channel'],
      payload['users'],
      payload['prepared_payload'],
      payload['blockchain'],
      payload['is_spam']
    )

    try {
      const response = await axios.post(FEED_BASE_URL + '/get_spam_feeds', {
        user: user_id,
        page: 1,
        pageSize: 10,
        op: 'read'
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.greaterThanOrEqual(1)
      expect(response.data.results[0].payload_id).to.equals(payload_id)
    } catch (err) {
      console.error('🔥  error in get spam feeds test: %s', err)
      expect(err).to.be.null
    } finally {
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/get_spam_feeds ::  get spam feeds test with empty results', async function () {
    const user_id = uuid.v4()
    try {
      const response = await axios.post(FEED_BASE_URL + '/get_spam_feeds', {
        user: user_id,
        page: 1,
        pageSize: 10,
        op: 'read'
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.equals(0)
    } catch (err) {
      console.error('🔥  error in get spam feeds test with empty results: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/feeds :: /apis/feeds/search ::  search feeds with empty result test ', async function () {
    const user_id = uuid.v4()
    try {
      const response = await axios.post(FEED_BASE_URL + '/search', {
        subscriber: user_id,
        page: 1,
        pageSize: 10,
        op: 'read'
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.equals(0)
    } catch (err) {
      console.error('🔥  error in search feeds with empty result test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/feeds :: /apis/feeds/search :: search feeds test ', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'

    const channelClass = Container.get(channelsClass)
    await channelClass._deleteChannel(channel, identity)
    await channelClass.addChannel(channel, channelType, identity)

    const channelService = Container.get(channelsService)
    await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
    await channelService.subscribe(channel, subscriber, BLOCKCHAIN)

    const payload_id = 1

    // Payload is not spam
    const payload = {
      payload_id: payload_id,
      channel: channel,
      users: [subscriber],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN',
      is_spam: 0
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)
    await feeds.addFeed(
      payload['payload_id'],
      payload['channel'],
      payload['users'],
      payload['prepared_payload'],
      payload['blockchain'],
      payload['is_spam']
    )

    try {
      const response = await axios.post(FEED_BASE_URL + '/search', {
        subscriber: subscriber,
        page: 1,
        pageSize: 10,
        op: 'read'
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.greaterThanOrEqual(1)
      expect(response.data.results[0].payload_id).to.equals(payload_id)
    } catch (err) {
      console.error('🔥  error in search feeds test: %s', err)
      expect(err).to.be.null
    } finally {
      await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
      await channelClass._deleteChannel(channel, identity)
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/search :: search feeds filter test (spam: false)', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const subscriber = uuid.v4()
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'

    const channelClass = Container.get(channelsClass)
    await channelClass._deleteChannel(channel, identity)
    await channelClass.addChannel(channel, channelType, identity)

    const channelService = Container.get(channelsService)
    await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
    await channelService.subscribe(channel, subscriber, BLOCKCHAIN)

    const payload_id = 1

    // Payload is spam
    const payload = {
      payload_id: payload_id,
      channel: channel,
      users: [subscriber],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN',
      is_spam: 1
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)
    await feeds.addFeed(
      payload['payload_id'],
      payload['channel'],
      payload['users'],
      payload['prepared_payload'],
      payload['blockchain'],
      payload['is_spam'],
      payload['hidden'],
      payload['etime']
    )

    // No spam in the filter
    try {
      const response = await axios.post(FEED_BASE_URL + '/search', {
        subscriber: subscriber,
        page: 1,
        pageSize: 10,
        op: 'read'
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.equals(0)
    } catch (err) {
      console.error('🔥  search feeds filter test (spam: false): %s', err)
      expect(err).to.be.null
    } finally {
      await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
      await channelClass._deleteChannel(channel, identity)
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/search :: search feeds filter test (spam: true)', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const subscriber = uuid.v4()
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'

    const channelClass = Container.get(channelsClass)
    await channelClass._deleteChannel(channel, identity)
    await channelClass.addChannel(channel, channelType, identity)

    const channelService = Container.get(channelsService)
    await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
    await channelService.subscribe(channel, subscriber, BLOCKCHAIN)

    const payload_id = 1

    // Payload is spam
    const payload = {
      payload_id: payload_id,
      channel: channel,
      users: [subscriber],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN',
      is_spam: 1
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)
    await feeds.addFeed(
      payload['payload_id'],
      payload['channel'],
      payload['users'],
      payload['prepared_payload'],
      payload['blockchain'],
      payload['is_spam']
    )

    // Spam in the filter

    try {
      const response = await axios.post(FEED_BASE_URL + '/search', {
        subscriber: subscriber,
        page: 1,
        pageSize: 10,
        op: 'read',
        isSpam: 1
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.greaterThanOrEqual(1)
      expect(response.data.results[0].payload_id).to.equals(payload_id)
    } catch (err) {
      console.error('🔥  error in search feeds filter test (spam: true): %s', err)
      expect(err).to.be.null
    } finally {
      await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
      await channelClass._deleteChannel(channel, identity)
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/search :: search feeds filter test with known searchTerm', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const subscriber = uuid.v4()
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'

    const channelClass = Container.get(channelsClass)
    await channelClass._deleteChannel(channel, identity)
    await channelClass.addChannel(channel, channelType, identity)

    const channelService = Container.get(channelsService)
    await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
    await channelService.subscribe(channel, subscriber, BLOCKCHAIN)

    const payload_id = 1

    const payload = {
      payload_id: payload_id,
      channel: channel,
      users: [subscriber],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN'
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)
    await feeds.addFeed(
      payload['payload_id'],
      payload['channel'],
      payload['users'],
      payload['prepared_payload'],
      payload['blockchain'],
      payload['is_spam']
    )

    try {
      const response = await axios.post(FEED_BASE_URL + '/search', {
        subscriber: subscriber,
        page: 1,
        pageSize: 10,
        op: 'read',
        searchTerm: 'ENS Domain expired'
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.greaterThanOrEqual(1)
      expect(response.data.results[0].payload_id).to.equals(payload_id)
    } catch (err) {
      console.error('🔥  error in search feeds filter test with known searchTerm: %s', err)
      expect(err).to.be.null
    } finally {
      await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
      await channelClass._deleteChannel(channel, identity)
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/search :: search feeds filter test with known searchTerm and spam true', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const subscriber = uuid.v4()
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'

    const channelClass = Container.get(channelsClass)
    await channelClass._deleteChannel(channel, identity)
    await channelClass.addChannel(channel, channelType, identity)

    const channelService = Container.get(channelsService)
    await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
    await channelService.subscribe(channel, subscriber, BLOCKCHAIN)

    const payload_id = 1

    // Payload is spam
    const payload = {
      payload_id: payload_id,
      channel: channel,
      users: [subscriber],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN',
      is_spam: 1
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)
    await feeds.addFeed(
      payload['payload_id'],
      payload['channel'],
      payload['users'],
      payload['prepared_payload'],
      payload['blockchain'],
      payload['is_spam']
    )

    try {
      const response = await axios.post(FEED_BASE_URL + '/search', {
        subscriber: subscriber,
        page: 1,
        pageSize: 10,
        op: 'read',
        searchTerm: 'ENS Domain expired',
        isSpam: 1
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.greaterThanOrEqual(1)
    } catch (err) {
      console.error(
        '🔥  error in search feeds filter test with known searchTerm and spam true %s',
        err
      )
      expect(err).to.be.null
    } finally {
      await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
      await channelClass._deleteChannel(channel, identity)
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/search :: search feeds filter test with unknown searchTerm', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const subscriber = uuid.v4()
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'

    const channelClass = Container.get(channelsClass)
    await channelClass._deleteChannel(channel, identity)
    await channelClass.addChannel(channel, channelType, identity)

    const channelService = Container.get(channelsService)
    await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
    await channelService.subscribe(channel, subscriber, BLOCKCHAIN)

    const payload_id = 1

    const payload = {
      payload_id: payload_id,
      channel: channel,
      users: [subscriber],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN'
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)
    await feeds.addFeed(
      payload['payload_id'],
      payload['channel'],
      payload['users'],
      payload['prepared_payload'],
      payload['blockchain'],
      payload['is_spam']
    )

    try {
      const response = await axios.post(FEED_BASE_URL + '/search', {
        subscriber: subscriber,
        page: 1,
        pageSize: 10,
        op: 'read',
        searchTerm: uuid.v4()
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.equals(0)
    } catch (err) {
      console.error('🔥  error in search feeds filter test with unknown searchTerm: %s', err)
      expect(err).to.be.null
    } finally {
      await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
      await channelClass._deleteChannel(channel, identity)
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/search :: search feeds filter test with known channel', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const subscriber = uuid.v4()
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'

    const channelClass = Container.get(channelsClass)
    await channelClass._deleteChannel(channel, identity)
    await channelClass.addChannel(channel, channelType, identity)

    const channelService = Container.get(channelsService)
    await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
    await channelService.subscribe(channel, subscriber, BLOCKCHAIN)

    const payload_id = 1

    // Payload is spam
    const payload = {
      payload_id: payload_id,
      channel: channel,
      users: [subscriber],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN'
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)
    await feeds.addFeed(
      payload['payload_id'],
      payload['channel'],
      payload['users'],
      payload['prepared_payload'],
      payload['blockchain'],
      payload['is_spam']
    )

    try {
      const response = await axios.post(FEED_BASE_URL + '/search', {
        subscriber: subscriber,
        page: 1,
        pageSize: 10,
        op: 'read',
        filter: JSON.stringify({
          channels: [channel]
        })
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.greaterThanOrEqual(1)
    } catch (err) {
      console.error('🔥  error in search feeds filter test with known channel: %s', err)
      expect(err).to.be.null
    } finally {
      await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
      await channelClass._deleteChannel(channel, identity)
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/search :: search feeds filter test with unknown channel', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const subscriber = uuid.v4()
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const channelType = 2
    const BLOCKCHAIN = 'ETH_TEST_KOVAN'

    const channelClass = Container.get(channelsClass)
    await channelClass._deleteChannel(channel, identity)
    await channelClass.addChannel(channel, channelType, identity)

    const channelService = Container.get(channelsService)
    await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
    await channelService.subscribe(channel, subscriber, BLOCKCHAIN)

    const payload_id = 1

    const payload = {
      payload_id: payload_id,
      channel: channel,
      users: [subscriber],
      prepared_payload: prepared_payload,
      blockchain: 'ETH_TEST_KOVAN'
    }

    const feeds = Container.get(FeedsService)
    await feeds._deleteFeed(payload_id)
    await feeds.addFeed(
      payload['payload_id'],
      payload['channel'],
      payload['users'],
      payload['prepared_payload'],
      payload['blockchain'],
      payload['is_spam'],
      payload['hidden'],
      payload['etime']
    )

    try {
      const response = await axios.post(FEED_BASE_URL + '/search', {
        subscriber: subscriber,
        page: 1,
        pageSize: 10,
        op: 'read',
        filter: JSON.stringify({
          channels: [uuid.v4()]
        })
      })
      expect(response).to.have.status(200)
      expect(response.data).not.to.be.null
      expect(response.data).to.have.any.keys('results')
      expect(response.data).to.have.any.keys('count')
      expect(response.data.results).to.be.an('array')
      expect(response.data.count).to.be.an('number')
      expect(response.data.count).to.be.equals(0)
    } catch (err) {
      console.error('🔥  error in search feeds filter test with unknown channel: %s', err)
      expect(err).to.be.null
    } finally {
      await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN)
      await channelClass._deleteChannel(channel, identity)
      await feeds._deleteFeed(payload_id)
    }
  })

  it('api/routes/feeds :: /apis/feeds/batch_process_feeds :: batch_process_feeds test', async function () {
    try {
      const response = await axios.post(FEED_BASE_URL + '/batch_process_feeds', {})
      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data).to.include({
        success: 1
      })
    } catch (err) {
      console.error('🔥  error in batch_process_feeds test: %s', err)
      expect(err).to.be.null
    }
  })
})
