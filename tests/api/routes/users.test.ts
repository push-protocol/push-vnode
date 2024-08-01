// **************************************************************************************************
// *
// *
// * THESE TESTS WERE FAILING. I CREATED A NEW FILE CALLED NEW.USERS.TEST.TS TO ADD THE NEW TESTS RELATED TO THE USERS ROUTE FOR PUSH CHAT
// *
// *
// *
// **************************************************************************************************
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
const V1_RELATIVE_URL = `v1/users`
const V1_BASE_URL = `${BASE_API_URL}/${V1_RELATIVE_URL}`

describe.skip('Testing :: api > routes > users', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  describe.skip(`Testing :: api > routes > users :: /${V1_RELATIVE_URL}/:userAddressInCAIP/delegations`, function () {
    it(`should return http code 200`, async function () {
      const userAddress = '0x87cd9E5a85960FdA817b29299465BDdbBeD51f9b'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/delegations/`,
        {}
      )
      expect(response).to.have.status(200)
    })

    it(`should return 1 or more result (if sync is done)`, async function () {
      const userAddress = '0x87cd9E5a85960FdA817b29299465BDdbBeD51f9b'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/delegations/`,
        {}
      )
      expect(response.data.info.result.length).to.be.greaterThanOrEqual(1)
    })

    it(`should return 0 result for 0x0000000000000000000000000000000000000001`, async function () {
      const userAddress = '0x0000000000000000000000000000000000000001'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/delegations/`,
        {}
      )

      expect(response.data.info.result.length).to.equal(0)
    })

    it(`should fail on incorrect address format`, async function () {
      const userAddress = '0x9e927c02C9eadXXXXXXEFb0Dd818943c7262Fb8e'

      try {
        await axios.get(
          `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/delegations/`,
          {}
        )
      } catch (err) {
        expect(err.response.status).to.equal(403)
      }
    })
  })

  describe.skip(`Testing :: api > routes > users :: /${V1_RELATIVE_URL}/:userAddressInCAIP/subscriptions`, function () {
    it(`should return http code 200`, async function () {
      const userAddress = '0x74415Bc4C4Bf4Baecc2DD372426F0a1D016Fa924'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/subscriptions/`,
        {}
      )
      expect(response).to.have.status(200)
    })

    it(`should return 10 or more result (if sync is done)`, async function () {
      const userAddress = '0x74415Bc4C4Bf4Baecc2DD372426F0a1D016Fa924'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/subscriptions/`,
        {}
      )
      expect(response.data.info.result.length).to.be.greaterThanOrEqual(10)
    })

    it(`should return 0 result for 0x0000000000000000000000000000000000000001`, async function () {
      const userAddress = '0x0000000000000000000000000000000000000001'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/subscriptions/`,
        {}
      )

      expect(response.data.info.result.length).to.equal(0)
    })

    it(`should fail on incorrect address format`, async function () {
      const userAddress = '0x74415BXXXX4Baecc2DD372426F0a1D016Fa924'

      try {
        await axios.get(
          `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/subscriptions/`,
          {}
        )
      } catch (err) {
        expect(err.response.status).to.equal(403)
      }
    })
  })

  describe.skip(`Testing :: api > routes > users :: /${V1_RELATIVE_URL}/:userAddressInCAIP/feeds`, function () {
    it(`should return http code 200`, async function () {
      const userAddress = '0x26c10f76ecdec3d43c492061640ab67093cb89ef'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/feeds/`,
        {}
      )
      expect(response).to.have.status(200)
    })

    it(`should return 3 or more result (if sync is done)`, async function () {
      const userAddress = '0x26c10f76ecdec3d43c492061640ab67093cb89ef'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/feeds/`,
        {}
      )
      expect(response.data.results.length).to.be.greaterThanOrEqual(3)
    })

    it(`should return 0 result for 0x0000000000000000000000000000000000000001`, async function () {
      const userAddress = '0x0000000000000000000000000000000000000001'

      const response = await axios.get(
        `${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/feeds/`,
        {}
      )

      expect(response.data.results.length).to.equal(0)
    })

    it(`should fail on incorrect address format`, async function () {
      const userAddress = '0x26c10f76ecdec3d43c492061640ab67093cb89ef'

      try {
        await axios.get(`${V1_BASE_URL}/eip155:${config.ethereumChainId}:${userAddress}/feeds/`, {})
      } catch (err) {
        expect(err.response.status).to.equal(403)
      }
    })
  })
})
