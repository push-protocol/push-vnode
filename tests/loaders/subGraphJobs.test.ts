import chai from 'chai'
import chaiHttp from 'chai-http'
import 'mocha'
import { Container } from 'typedi'
import { startServer, stopServer } from '../../src/appInit'
import channelsClass from '../../src/services/channelsCompositeClasses/channelsClass'
import { fetchSubgraphNotifications } from '../../src/loaders/subGraphJobs'
chai.use(chaiHttp)
chai.should()
const expect = chai.expect

describe.skip('api/services/channelscompositeClasses/channelsClass :: channelsClass test', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  it('src/loaders/subGraphJobs :: fetchSubgraphNotifications test', async function () {
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
    const subgraphDetails =
      '0x36302b516d656e746479574a613267565336725258454c6f4d625a7943466f58666966574668503741486b716357483478'
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
      await channelClass.addSubGraphDetails(channel, subgraphDetails)

      const logger = Container.get('logger')
      // simulate 3 retries
      for (let i = 0; i <= 4; i++) {
        try {
          await fetchSubgraphNotifications(
            channel,
            1,
            1,
            'QmentdyWJa2gVS6rRXELoMbZyCFoXfifWFhP7AHkqcWH4x',
            logger
          )
        } catch (error) {}
      }
      const channelDetails = await channelClass.getChannel(channel)
      console.log(channelDetails)
      expect(channelDetails.subgraph_details).to.be.null
    } catch (error) {
      console.error('🔥  error in getEthChannelFromAliasAddress test: %s', error)
      expect(error).to.be.null
    } finally {
      await channelClass._deleteChannel(channel, identity)
    }
  })
})
