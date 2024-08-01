import chai from 'chai'
import chaiHttp from 'chai-http'
import 'mocha'
import { Container } from 'typedi'
import { startServer, stopServer } from '../../../src/appInit'
const axios = require('axios').default
import PayloadsService from '../../../src/services/payloadsService'

var uuid = require('uuid')

chai.use(chaiHttp)
chai.should()
const expect = chai.expect

const BASE_URL = 'http://[::1]:4000/apis/payloads'

describe.skip('TEST CASES - api/routes/payloads :: payloads delivery test', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  it('api/routes/payloads :: /apis/payloads/add :: add correct payload type 1, verificationType as EIP712', async function () {
    const verificationProof =
      'EIP712:0x54566ad7928db6f78e69d7e18c7760ff92d2f2a32c749485242f8cc4a8db3c87'
    const channel = '0xd8634c39bbfd4033c0d3289c4515275102423681'
    const recipient = '0xd8634c39bbfd4033c0d3289c4515275102423681'
    const identity =
      '0x312b6261666b726569637574747235677062797a796e36637961707863746c7237646b326736666e7964717879366c70733432346d636a636e37337765'
    const source = 'ETH_TEST_KOVAN'
    const payload = null

    const payloadsService = Container.get(PayloadsService)
    await payloadsService._deletePayload(verificationProof)

    try {
      const response = await axios.post(BASE_URL + '/add', {
        verificationProof: verificationProof,
        channel: channel,
        recipient: recipient,
        identity: identity,
        source: source,
        payload: payload
      })

      expect(response).to.have.status(201)
    } catch (err) {
      console.error('🔥  error in adding payload test: %s', err)
      expect(err).to.be.null
    } finally {
      payloadsService._deletePayload(verificationProof)
    }
  })
})
