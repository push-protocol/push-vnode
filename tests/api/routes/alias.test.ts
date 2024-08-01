import chai from 'chai'
const chaiAsPromised = require('chai-as-promised')

import chaiHttp from 'chai-http'
import 'mocha'

import { startServer, stopServer } from '../../../src/appInit'
const axios = require('axios').default
import config from '../../../src/config'

var uuid = require('uuid')
var readline = require('readline')

chai.use(chaiHttp)
chai.use(chaiAsPromised)
chai.should()
const expect = chai.expect

const BASE_API_URL = 'http://[::1]:4000/apis'
const V1_RELATIVE_URL = `v1/alias`
const V1_BASE_URL = `${BASE_API_URL}/${V1_RELATIVE_URL}`

describe.skip('Testing :: api > routes > alias', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  describe(`Testing :: api > routes > alias :: /${V1_RELATIVE_URL}/:userAddressInCAIP/channel`, function () {
    it(`should return http code 200`, async function () {
      const aliasAddress = '0x84EC52C57A93cE71F143600129B7bc6b4b3D3776'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${aliasAddress}/channel/`,
        {}
      )
      expect(response).to.have.status(200)
    })

    it(`should return 0 result for 0x0000000000000000000000000000000000000001`, async function () {
      const aliasAddress = '0x0000000000000000000000000000000000000001'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${aliasAddress}/channel/`,
        {}
      )

      expect(response.data.ethAddress).to.equal(null)
    })

    it(`should fail on incorrect address format`, async function () {
      const aliasAddress = '0x9e927c02C9eadXXXXXXEFb0Dd818943c7262Fb8e'

      try {
        await axios.get(
          `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${aliasAddress}/channel/`,
          {}
        )
      } catch (err) {
        expect(err.response.status).to.equal(403)
      }
    })
  })
})
