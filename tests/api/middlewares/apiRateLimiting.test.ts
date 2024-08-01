import chai from 'chai'
import chaiHttp from 'chai-http'
import 'mocha'
import { Container } from 'typedi'
import { startServer, stopServer } from '../../../src/appInit'
const axios = require('axios').default
import channelsClass from '../../../src/services/channelsCompositeClasses/channelsClass'

const CHANNEL_BASE_URL = 'http://[::1]:4000/apis/channels'

chai.use(chaiHttp)
chai.should()
const expect = chai.expect

function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}
describe.skip('api/routes/middlewares :: apiRateLimiting.ts test', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  it('api/routes/middlewares :: /apis/channels/get :: should error out 429 on exceeding api limit', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822f2'
    const channelType = 2
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'

    const channelClass = Container.get(channelsClass)
    await channelClass._deleteChannel(channel, identity)
    await channelClass.addChannel(channel, channelType, identity)

    try {
      const channelPromises = []
      for (let i = 0; i < 12; i++)
        channelPromises.push(
          axios.post(CHANNEL_BASE_URL + '/get', {
            channel: channel
          })
        )
      Promise.all(channelPromises)
      const response = await axios.post(CHANNEL_BASE_URL + '/get', {
        channel: channel
      })
      //   expect(response).to.have.status(201);
      //   expect(response.data).not.to.be.null;
      //   expect(response.data).to.include({ channel: channel });
    } catch (err) {
      console.error('🔥  error in get channel test: %s', err)
      expect(err).to.have.status(429)
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })

  it('api/routes/middlewares :: /apis/channels/get :: should be able to handle request after passage of time (1 sec)', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822f2'
    const channelType = 2
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'

    const channelClass = Container.get(channelsClass)
    await channelClass._deleteChannel(channel, identity)
    await channelClass.addChannel(channel, channelType, identity)

    try {
      const channelPromises = []
      for (let i = 0; i < 12; i++)
        channelPromises.push(
          axios.post(CHANNEL_BASE_URL + '/get', {
            channel: channel
          })
        )
      Promise.all(channelPromises)
      // Sleep for a second and try calling the API again
      await sleep(1000)
      const response = await axios.post(CHANNEL_BASE_URL + '/get', {
        channel: channel
      })
      expect(response).to.have.status(201)
      expect(response.data).not.to.be.null
      expect(response.data).to.include({ channel: channel })
    } catch (err) {
      console.error('🔥  error in get channel test: %s', err)
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })
})
