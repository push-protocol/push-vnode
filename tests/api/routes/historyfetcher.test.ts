import chai from 'chai'
import chaiHttp from 'chai-http'
import 'mocha'
import { startServer, stopServer } from '../../../src/appInit'
const axios = require('axios').default

chai.use(chaiHttp)
chai.should()
const expect = chai.expect
var uuid = require('uuid')

const HISTORY_FETCHER_BASE_URL = 'http://[::1]:4000/apis/historyfetcher'
const BLOCKCHAIN_TYPE: string[] = ['ETH_TEST_KOVAN', 'POLYGON_TEST_MUMBAI']

describe.skip('TEST CASES - api/routes/historyfetcher :: historyfetcher tests', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  it('api/routes/historyfetcher :: /apis/historyfetcher/get_protocol_meta :: get get_protocol_meta test', async function () {
    for (let i = 0; i < BLOCKCHAIN_TYPE.length; i++) {
      const payload = {
        blockchain: BLOCKCHAIN_TYPE[i]
      }
      try {
        const response = await axios.post(HISTORY_FETCHER_BASE_URL + '/get_protocol_meta', payload)
        expect(response).to.have.status(201)
        expect(response.data).not.to.be.null
        expect(response.data).to.be.an('array')
        expect(response.data.length).to.be.equals(1)
        expect(response.data[0].id).not.to.be.null
        expect(response.data[0].id).to.be.an('number')
        expect(response.data[0].type).not.to.be.null
        expect(response.data[0].data_1).not.to.be.null
        expect(response.data[0].data_2).not.to.be.null
        expect(response.data[0].data_3).not.to.be.null
      } catch (err) {
        console.error('🔥  error in get_protocol_meta test: %s', err)
        expect(err).to.be.null
      }
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/update_protocol_meta ::  update_protocol_meta test', async function () {
    for (let i = 0; i < BLOCKCHAIN_TYPE.length; i++) {
      const payload = {
        blockchain: BLOCKCHAIN_TYPE[i]
      }
      try {
        let response = await axios.post(HISTORY_FETCHER_BASE_URL + '/get_protocol_meta', payload)

        let data_1 = response.data[0].data_1
        let data_2 = response.data[0].data_2
        let data_3 = response.data[0].data_3

        data_1 = String(parseInt(data_1) - 1)
        data_2 = String(parseInt(data_2) - 1)
        data_3 = String(parseInt(data_3) - 1)

        const update_payload = {
          blockchain: BLOCKCHAIN_TYPE[i],
          data_1: data_1,
          data_2: data_2,
          data_3: data_3
        }

        const res = await axios.post(
          HISTORY_FETCHER_BASE_URL + '/update_protocol_meta',
          update_payload
        )

        response = await axios.post(HISTORY_FETCHER_BASE_URL + '/get_protocol_meta', payload)
        expect(response).to.have.status(201)
        expect(response.data).not.to.be.null
        expect(response.data).to.be.an('array')
        expect(response.data.length).to.be.equals(1)
        expect(response.data[0].id).not.to.be.null
        expect(response.data[0].id).to.be.an('number')
        expect(response.data[0].type).not.to.be.null
        expect(response.data[0].data_1).not.to.be.null
        expect(response.data[0].data_2).not.to.be.null
        expect(response.data[0].data_3).not.to.be.null
        expect(response.data[0].data_1).to.be.equals(data_1)
        expect(response.data[0].data_2).to.be.equals(data_2)
        expect(response.data[0].data_3).to.be.equals(data_3)
      } catch (err) {
        console.error('🔥  error in update_protocol_meta test: %s', err)
        expect(err).to.be.null
      }
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/sync_protocol_data ::  sync_protocol_data test', async function () {
    for (let i = 0; i < BLOCKCHAIN_TYPE.length; i++) {
      const payload = {
        blockchain: BLOCKCHAIN_TYPE[i]
      }
      try {
        let response = await axios.post(HISTORY_FETCHER_BASE_URL + '/get_protocol_meta', payload)

        const data_1 = parseInt(response.data[0].data_1)
        const data_2 = parseInt(response.data[0].data_2)
        const data_3 = parseInt(response.data[0].data_3)

        const res = await axios.post(HISTORY_FETCHER_BASE_URL + '/sync_protocol_data', {})
        expect(res).to.have.status(201)
        expect(res.data).not.to.be.null
        expect(res.data).to.be.equals(true)

        response = await axios.post(HISTORY_FETCHER_BASE_URL + '/get_protocol_meta', payload)
        expect(response).to.have.status(201)
        expect(response.data).not.to.be.null
        expect(response.data).to.be.an('array')
        expect(response.data.length).to.be.equals(1)
        expect(response.data[0].id).not.to.be.null
        expect(response.data[0].id).to.be.an('number')
        expect(response.data[0].type).not.to.be.null
        expect(response.data[0].data_1).not.to.be.null
        expect(response.data[0].data_2).not.to.be.null
        expect(response.data[0].data_3).not.to.be.null
        expect(parseInt(response.data[0].data_1)).to.be.greaterThan(data_1)
        expect(parseInt(response.data[0].data_2)).to.be.greaterThan(data_2)
        expect(parseInt(response.data[0].data_3)).to.be.greaterThan(data_3)
      } catch (err) {
        console.error('🔥  error in sync_protocol_data test: %s', err)
        expect(err).to.be.null
      }
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/get_channels_history ::  get_channels_history test', async function () {
    const payload = {
      from_block: 31981860,
      to_block: 31981870,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(HISTORY_FETCHER_BASE_URL + '/get_channels_history', payload)

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data).to.be.an('object')
      expect(response.data).to.be.an('object').that.is.not.empty
    } catch (err) {
      console.error('🔥  error in get_channels_history test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/get_channels_history ::  get_channels_history with no data test', async function () {
    const payload = {
      from_block: 32272000,
      to_block: 32272000,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(HISTORY_FETCHER_BASE_URL + '/get_channels_history', payload)

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data).to.be.an('object')
      expect(response.data).to.be.an('object').that.is.empty
    } catch (err) {
      console.error('🔥  error in get_channels_history with no data test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/sync_channels_data ::  sync_channels_data test', async function () {
    const payload = {
      from_block: 31981860,
      to_block: 31981870,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(HISTORY_FETCHER_BASE_URL + '/sync_channels_data', payload)

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data.totalChannels).not.to.be.null
      expect(response.data.totalChannels).to.be.greaterThanOrEqual(1)
    } catch (err) {
      console.error('🔥  error in sync_channels_data test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/sync_channels_data ::  sync_channels_data with no data test', async function () {
    const payload = {
      from_block: 32272000,
      to_block: 32272000,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(HISTORY_FETCHER_BASE_URL + '/sync_channels_data', payload)

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data.totalChannels).not.to.be.null
      expect(response.data.totalChannels).to.be.equals(0)
    } catch (err) {
      console.error('🔥  error in sync_channels_data with no data test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/get_subscribers_history ::  get_subscribers_history test', async function () {
    const payload = {
      from_block: 31981860,
      to_block: 31981870,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(
        HISTORY_FETCHER_BASE_URL + '/get_subscribers_history',
        payload
      )

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data).to.be.an('object')
      expect(response.data).to.be.an('object').that.is.not.empty
      expect(response.data.subscribeEvents).to.be.an('object')
      expect(response.data.subscribeEvents).to.be.an('object').that.is.not.empty
      expect(response.data.unsubscribeEvents).to.be.an('object')
    } catch (err) {
      console.error('🔥  error in get_subscribers_history test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/get_subscribers_history ::  get_subscribers_history with no data test', async function () {
    const payload = {
      from_block: 32272000,
      to_block: 32272000,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(
        HISTORY_FETCHER_BASE_URL + '/get_subscribers_history',
        payload
      )

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data).to.be.an('object')
      expect(response.data).to.be.an('object').that.is.not.empty
      expect(response.data.subscribeEvents).to.be.an('object').that.is.empty
      expect(response.data.unsubscribeEvents).to.be.an('object').that.is.empty
    } catch (err) {
      console.error('🔥  error in get_subscribers_history with no data test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/sync_subscribers_data ::  sync_subscribers_data test', async function () {
    const payload = {
      from_block: 31981860,
      to_block: 31981870,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(
        HISTORY_FETCHER_BASE_URL + '/sync_subscribers_data',
        payload
      )

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data).to.be.an('object')
      expect(response.data).to.be.an('object').that.is.not.empty
      expect(response.data.subscribed).to.be.an('number')
      expect(response.data.subscribed).to.be.greaterThanOrEqual(0)
      expect(response.data.unsubscribed).to.be.an('number')
      expect(response.data.unsubscribed).to.be.greaterThanOrEqual(0)
    } catch (err) {
      console.error('🔥  error in sync_subscribers_data test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/get_notifications_history ::  get_notifications_history test', async function () {
    const payload = {
      from_block: 22272000,
      to_block: 32273000,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(
        HISTORY_FETCHER_BASE_URL + '/get_notifications_history',
        payload
      )

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data).to.be.an('array')
      expect(response.data.length).to.be.greaterThanOrEqual(0)

      if (response.data.length > 0) {
        expect(response.data[0].channel).not.to.be.null
        expect(response.data[0].recipient).not.to.be.null
        expect(response.data[0].identity).not.to.be.null
        expect(response.data[0].trxHash).not.to.be.null
        expect(response.data[0].isSpam).not.to.be.null
      }
    } catch (err) {
      console.error('🔥  error in get_notifications_history test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/get_notifications_history ::  get_notifications_history with no data test', async function () {
    const payload = {
      from_block: 32273000,
      to_block: 32273000,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(
        HISTORY_FETCHER_BASE_URL + '/get_notifications_history',
        payload
      )

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data).to.be.an('array')
      expect(response.data.length).to.be.equals(0)
    } catch (err) {
      console.error('🔥  error in get_notifications_history with no data test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/sync_notifications_data ::  sync_notifications_data test', async function () {
    const payload = {
      from_block: 31272000,
      to_block: 32273000,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(
        HISTORY_FETCHER_BASE_URL + '/sync_notifications_data',
        payload
      )

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data.totalNotifications).not.to.be.null
      expect(response.data.totalNotifications).to.be.an('number')
      expect(response.data.totalNotifications).to.be.greaterThanOrEqual(0)
    } catch (err) {
      console.error('🔥  error in sync_notifications_data test: %s', err)
      expect(err).to.be.null
    }
  })

  it('api/routes/historyfetcher :: /apis/historyfetcher/sync_notifications_data ::  sync_notifications_data with no data test', async function () {
    const payload = {
      from_block: 32273000,
      to_block: 32273000,
      blockchain: BLOCKCHAIN_TYPE[0]
    }

    try {
      const response = await axios.post(
        HISTORY_FETCHER_BASE_URL + '/sync_notifications_data',
        payload
      )

      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data.totalNotifications).not.to.be.null
      expect(response.data.totalNotifications).to.be.an('number')
      expect(response.data.totalNotifications).to.be.equals(0)
    } catch (err) {
      console.error('🔥  error in sync_notifications_data with no data test: %s', err)
      expect(err).to.be.null
    }
  })
})
