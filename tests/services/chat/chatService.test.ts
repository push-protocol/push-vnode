import chai from 'chai'
import chaiHttp from 'chai-http'
import 'mocha'
import { startServer, stopServer } from '../../../src/appInit'

chai.use(chaiHttp)
chai.should()
const expect = chai.expect

describe.skip('ChatService  :: chat test', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  it('services/chatService:walletAddressExists should return true', async function () {
    try {
      const result = await walletAddressExists('eip155:0xD8634C39BBFd4033c0d3289C4515275102423681')
      expect(result).to.true
    } catch (err) {
      console.error('🔥  error in subscribeTo test: %s', err)
      expect(err).to.be.null
    } finally {
    }
  })

  it('services/chatService:walletAddressExists should return false', async function () {
    try {
      const result = await walletAddressExists('eip155:0xD8634C39BBFd4033c0d328C4515275102423681')
      expect(result).to.false
    } catch (err) {
      console.error('🔥  error in subscribeTo test: %s', err)
      expect(err).to.be.null
    } finally {
    }
  })
})
