import 'mocha'

import chai from 'chai'
import chaiHttp from 'chai-http'
import { Container } from 'typedi'

import { startServer, stopServer } from '../../src/appInit'
import config from '../../src/config'
import * as utilsHelper from '../../src/helpers/utilsHelper'
import channelsClass from '../../src/services/channelsCompositeClasses/channelsClass'
import subscribersClass from '../../src/services/channelsCompositeClasses/subscribersClass'
import payloadService from '../../src/services/payloadsService'
const ETH_CAIP = config.ethereumId

chai.use(chaiHttp)
chai.should()
const expect = chai.expect

describe('Payload Service: Notification Setting Test ', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())
  describe('Payload Service: Test For ETH Channel:: No channel setting and user setting', function () {
    // targted
    it('channel sends targeted notification to a non-subscriber:: should be marked as spam ', async function () {
      // create a dummy channel with no notification setting
      const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
      const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
      const channelType = 2
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      const payload = Container.get(payloadService)
      const channel_name = 'channel_name'
      const channel_info = 'channel_info'
      const channel_url = 'channel_url'
      const channel_icon = 'channel_icon'
      const payloadData = {
        verificationProof:
          'eip712v2:0x5a768de55e7c501839b208c5fdc5a304b2981cdcd6e7d82703679bbd5d625da27c292d648463a8525c153a916452d45af675b457ab3c0cf77c7bea17ce5fe1351c::uid::37dc91ca-3968-48f6-9e85-b50d2c7d10531',
        identity:
          '2+{"notification":{"title":"","body":"testing targted"},"data":{"acta":"","aimg":"","amsg":"testing targted","asub":"","type":"3"},"recipients":"eip155:5:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c"}',
        sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        source: 'ETH_TEST_GOERLI',
        recipient: 'eip155:5:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c'
      }
      try {
        await channelClass._deleteChannel(channel, identity)
        await channelClass.addChannel(channel, channelType, identity)
        await channelClass._populateChannelData(
          channel,
          channel_name,
          channel_info,
          channel_url,
          channel_icon,
          null,
          null
        )
        // subscribe an address to the channel
        await subscriberClass.subscribeTo(
          channel,
          null,
          subscriber1,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        await subscriberClass.subscribeTo(
          channel,
          null,
          subscriber2,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        // add payload
        const response = await payload.addExternalPayload(
          payloadData.verificationProof,
          channel,
          0,
          payloadData.recipient,
          payloadData.source,
          payloadData.identity
        )
        await payload.batchProcessPayloads()
        expect(response).to.be.true
      } catch (err) {
      } finally {
        await channelClass._deleteChannel(channel, identity)
        await subscriberClass._deleteSubscriber(channel, subscriber1)
        await subscriberClass._deleteSubscriber(channel, subscriber2)
        await payload._deletePayload(payloadData.verificationProof)
      }
    })
    it('channel sends targeted notification to a subscriber:: shoud not be marked as spam', async function () {
      // create a dummy channel with no notification setting
      const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
      const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
      const channelType = 2
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      const payload = Container.get(payloadService)
      const channel_name = 'channel_name'
      const channel_info = 'channel_info'
      const channel_url = 'channel_url'
      const channel_icon = 'channel_icon'
      const payloadData = {
        verificationProof:
          'eip712v2:0x70bc9666be85bf8f48830d7b2fcc04f6759863dec7d19e7d7eaf826a0370cbc664e5bad47c05f0ac0747f17a987d873e72ea3f9f9d803f9eaaccbf2c0d362f311b::uid::087b32d9-9c3d-464b-90d4-99ded122b3bc1',
        identity:
          '2+{"notification":{"title":"","body":"hey "},"data":{"acta":"","aimg":"","amsg":"hey ","asub":"","type":"3"},"recipients":"eip155:5:0xfFA1aF9E558B68bBC09ad74058331c100C135280"}',
        sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        source: 'ETH_TEST_GOERLI',
        recipient: 'eip155:5:0xfFA1aF9E558B68bBC09ad74058331c100C135280'
      }
      try {
        await channelClass._deleteChannel(channel, identity)
        await channelClass.addChannel(channel, channelType, identity)
        await channelClass._populateChannelData(
          channel,
          channel_name,
          channel_info,
          channel_url,
          channel_icon,
          null,
          null
        )
        // subscribe an address to the channel
        await subscriberClass.subscribeTo(
          channel,
          null,
          subscriber1,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        await subscriberClass.subscribeTo(
          channel,
          null,
          subscriber2,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        // add payload
        const response = await payload.addExternalPayload(
          payloadData.verificationProof,
          channel,
          0,
          payloadData.recipient,
          payloadData.source,
          payloadData.identity
        )
        await payload.batchProcessPayloads()
        expect(response).to.be.true
      } catch (err) {
      } finally {
        await channelClass._deleteChannel(channel, identity)
        await subscriberClass._deleteSubscriber(channel, subscriber1)
        await subscriberClass._deleteSubscriber(channel, subscriber2)
        await payload._deletePayload(payloadData.verificationProof)
      }
    })
    //braodcast
    it("channel sends braodcast notification:: should be sent to all it's subscribers", async function () {
      // create a dummy channel with no notification setting
      const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
      const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
      const channelType = 2
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      const payload = Container.get(payloadService)
      const channel_name = 'channel_name'
      const channel_info = 'channel_info'
      const channel_url = 'channel_url'
      const channel_icon = 'channel_icon'
      const payloadData = {
        verificationProof:
          'eip712v2:0xaf8c581735c2bff94bbcb695ec2bf2f24e78bd9cec7f178eccf7a1a2c92a4d8b186b9d43a42c22230c140691745cda7439a0e2f49fc359be4f7704b421600c061b::uid::6de5ec9f-54af-4060-8dec-5a573a791a561',
        identity:
          '2+{"notification":{"title":"","body":"test broadcast notif ethereum"},"data":{"acta":"","aimg":"","amsg":"test broadcast notif ethereum","asub":"","type":"1"},"recipients":"eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029"}',
        sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        source: 'ETH_TEST_GOERLI',
        recipient: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      }
      try {
        await channelClass._deleteChannel(channel, identity)
        await channelClass.addChannel(channel, channelType, identity)
        await channelClass._populateChannelData(
          channel,
          channel_name,
          channel_info,
          channel_url,
          channel_icon,
          null,
          null
        )
        // subscribe an address to the channel
        await subscriberClass.subscribeTo(
          channel,
          null,
          subscriber1,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        await subscriberClass.subscribeTo(
          channel,
          null,
          subscriber2,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        // add payload
        const response = await payload.addExternalPayload(
          payloadData.verificationProof,
          channel,
          0,
          payloadData.recipient,
          payloadData.source,
          payloadData.identity
        )
        await payload.batchProcessPayloads()
        expect(response).to.be.true
      } catch (err) {
      } finally {
        await channelClass._deleteChannel(channel, identity)
        await subscriberClass._deleteSubscriber(channel, subscriber1)
        await subscriberClass._deleteSubscriber(channel, subscriber2)
        await payload._deletePayload(payloadData.verificationProof)
      }
    })
    // subset
  })
  describe('Payload Service:Test For Alias Channel :: No channel setting and user setting', function () {
    it('Alias sends targeted notification to a non-subscriber :: should be marked as spam', async function () {
      // create a dummy channel with no notification setting
      const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const aliasAddress = `eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
      const subscribeVerificationProof = `eip712:0x7e996feac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
      const channelType = 2
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      const payload = Container.get(payloadService)
      const channel_name = 'channel_name'
      const channel_info = 'channel_info'
      const channel_url = 'channel_url'
      const channel_icon = 'channel_icon'
      const payloadData = {
        verificationProof:
          'eip712v2:0xb69fa90c9d2e5dff60691c8f7f3d79bc720711b8eab534437c981f58bf6ffdf01686301a5701dbec16c315958eedc217c7598cb3d00e3dac08b24245789293031b::uid::42e4b78e-b6b8-4f29-9058-e5a1ec3dba34',
        identity:
          '2+{"notification":{"title":"","body":"testing targeted alias unsub notif"},"data":{"acta":"","aimg":"","amsg":"testing targeted alias unsub notif","asub":"","type":"3"},"recipients":"eip155:80001:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c"}',
        sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
        source: 'POLYGON_TEST_MUMBAI',
        recipient: 'eip155:80001:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c'
      }
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
          '80001'
        )
        await channelClass._verifyChannelAlias(channel)
        // subscribe an address to the channel
        await subscriberClass.subscribeTo(
          channel,
          aliasAddress,
          subscriber1,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        await subscriberClass.subscribeTo(
          channel,
          aliasAddress,
          subscriber2,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        // add payload
        const response = await payload.addExternalPayload(
          payloadData.verificationProof,
          payloadData.sender,
          0,
          payloadData.recipient,
          payloadData.source,
          payloadData.identity
        )
        await payload.batchProcessPayloads()
        expect(response).to.be.true
      } catch (err) {
      } finally {
        await channelClass._deleteChannel(channel, identity)
        await subscriberClass._deleteSubscriber(channel, subscriber1)
        await subscriberClass._deleteSubscriber(channel, subscriber2)
        await payload._deletePayload(payloadData.verificationProof)
      }
    })
    it('Alias sends targated notification to a subscriber:: should not be marked as spam', async function () {
      // create a dummy channel with no notification setting
      const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const aliasAddress = `eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
      const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
      const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
      const channelType = 2
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      const payload = Container.get(payloadService)
      const channel_name = 'channel_name'
      const channel_info = 'channel_info'
      const channel_url = 'channel_url'
      const channel_icon = 'channel_icon'
      const payloadData = {
        verificationProof:
          'eip712v2:0x27a30b633afc07e8a74ba213931336a07045d4e61833f3c017ea365b460e605438f169506624635ebba5120f3b53c0ee8bc1bde039fdd8df004642c1f2d392d21c::uid::f7600e37-fbd0-4b9f-9b33-60a9fd6662b8',
        identity:
          '2+{"notification":{"title":"","body":"testing alias"},"data":{"acta":"","aimg":"","amsg":"testing alias","asub":"","type":"3"},"recipients":"eip155:80001:0xfFA1aF9E558B68bBC09ad74058331c100C135280"}',
        sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
        source: 'POLYGON_TEST_MUMBAI',
        recipient: 'eip155:80001:0xfFA1aF9E558B68bBC09ad74058331c100C135280'
      }
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
          '80001'
        )
        await channelClass._verifyChannelAlias(channel)
        // subscribe an address to the channel
        await subscriberClass.subscribeTo(
          channel,
          aliasAddress,
          subscriber1,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        await subscriberClass.subscribeTo(
          channel,
          aliasAddress,
          subscriber2,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        // add payload
        const response = await payload.addExternalPayload(
          payloadData.verificationProof,
          payloadData.sender,
          0,
          payloadData.recipient,
          payloadData.source,
          payloadData.identity
        )
        await payload.batchProcessPayloads()
        expect(response).to.be.true
      } catch (err) {
      } finally {
        await channelClass._deleteChannel(channel, identity)
        await subscriberClass._deleteSubscriber(channel, subscriber1)
        await subscriberClass._deleteSubscriber(channel, subscriber2)
        await payload._deletePayload(payloadData.verificationProof)
      }
    })
    it('Alias sends braodcast notification:: should be sent to all its subscribers', async function () {
      // create a dummy channel with no notification setting
      const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
      const aliasAddress = `eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
      const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
      const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
      const channelType = 2
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      const payload = Container.get(payloadService)
      const channel_name = 'channel_name'
      const channel_info = 'channel_info'
      const channel_url = 'channel_url'
      const channel_icon = 'channel_icon'
      const payloadData = {
        verificationProof:
          'eip712v2:0x746562c7ffb043c94fa8152615e911529cc4b45c965ed8e471687c002c0695a772d8a850c6df3f1ac75fe4e35b23e0455d8cb2485fc2942d39306ca6ffbfa08d1b::uid::6cb87584-6d92-4deb-bddf-6ea2e13a936c',
        identity:
          '2+{"notification":{"title":"","body":"testing alias broadcast"},"data":{"acta":"","aimg":"","amsg":"testing alias broadcast","asub":"","type":"1"},"recipients":"eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D"}',
        sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
        source: 'POLYGON_TEST_MUMBAI',
        recipient: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D'
      }
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
          '80001'
        )
        await channelClass._verifyChannelAlias(channel)
        // subscribe an address to the channel
        await subscriberClass.subscribeTo(
          channel,
          aliasAddress,
          subscriber1,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        await subscriberClass.subscribeTo(
          channel,
          aliasAddress,
          subscriber2,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
          subscribeVerificationProof,
          null
        )
        // add payload
        const response = await payload.addExternalPayload(
          payloadData.verificationProof,
          payloadData.sender,
          0,
          payloadData.recipient,
          payloadData.source,
          payloadData.identity
        )
        await payload.batchProcessPayloads()
        expect(response).to.be.true
      } catch (err) {
      } finally {
        await channelClass._deleteChannel(channel, identity)
        await subscriberClass._deleteSubscriber(channel, subscriber1)
        await subscriberClass._deleteSubscriber(channel, subscriber2)
        await payload._deletePayload(payloadData.verificationProof)
      }
    })
  })

  // Eth Channel setting but no user setting . this causes the logic to pick up the default value instead
  describe('Payload Service: Test For ETH Channel :: channel setting present but user setting is not there', function () {
    describe('Channel doest not pass the notification index while triggering the notification', function () {
      // targted
      it('Channel triggers a targeted notification to non-subscriber:: should be marked as spam', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x5a768de55e7c501839b208c5fdc5a304b2981cdcd6e7d82703679bbd5d625da27c292d648463a8525c153a916452d45af675b457ab3c0cf77c7bea17ce5fe1351c::uid::37dc91ca-3968-48f6-9e85-b50d2c7d1053',
          identity:
            '2+{"notification":{"title":"","body":"testing targted"},"data":{"acta":"","aimg":"","amsg":"testing targted","asub":"","type":"3"},"recipients":"eip155:5:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c"}',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          source: 'ETH_TEST_GOERLI',
          recipient: 'eip155:5:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      it('Channel triggers a targeted notification to a subscriber:: should not be marked as spam and should be delivered', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x70bc9666be85bf8f48830d7b2fcc04f6759863dec7d19e7d7eaf826a0370cbc664e5bad47c05f0ac0747f17a987d873e72ea3f9f9d803f9eaaccbf2c0d362f311b::uid::087b32d9-9c3d-464b-90d4-99ded122b3bc',
          identity:
            '2+{"notification":{"title":"","body":"hey "},"data":{"acta":"","aimg":"","amsg":"hey ","asub":"","type":"3"},"recipients":"eip155:5:0xfFA1aF9E558B68bBC09ad74058331c100C135280"}',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          source: 'ETH_TEST_GOERLI',
          recipient: 'eip155:5:0xfFA1aF9E558B68bBC09ad74058331c100C135280'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      //braodcast
      it('Channel triggers broadcast notification:: should be delivered to all the subscribers', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xaf8c581735c2bff94bbcb695ec2bf2f24e78bd9cec7f178eccf7a1a2c92a4d8b186b9d43a42c22230c140691745cda7439a0e2f49fc359be4f7704b421600c061b::uid::6de5ec9f-54af-4060-8dec-5a573a791a56',
          identity:
            '2+{"notification":{"title":"","body":"test broadcast notif ethereum"},"data":{"acta":"","aimg":"","amsg":"test broadcast notif ethereum","asub":"","type":"1"},"recipients":"eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029"}',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          source: 'ETH_TEST_GOERLI',
          recipient: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-0-50-20-100+1-1+2-1-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      // subset
    })

    describe('Channel triggers a notification present in index 1 which is of type boolean and subscribers do not have user setting, it should go with default option ', function () {
      // targted
      it('Channel triggers targeted notification to a non-subscriber:: should be marked as spam.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x6c1a372021220848103e8e8353f684986badd87fa90462bf4ddc83391e04614f79c6176aa2781b88349f32b49decaf164bf27605db51ab464798c5d6526427041b::uid::1684312610',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"1-1"},"recipients":{"0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      it('Channel triggeres targeted notification to a subscriber:: should go with default channel setting and should not reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xf366eecbf7c5e42995c3089b7f96f41d1c27352dcef21e18105ce500b60a99b6028af335c67fd01bf2c739a51164fe8e7d0d372e99e5adf3855091728f63f3c81c::uid::1684312700',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"1-1"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      //braodcast
      it('Channel triggers broadcast notification :: should go with default channel setting and should not reach the users', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x6842b982c0c148e21dbe6eacd17059c1ce1fa6e57221c84c9d6f6ad97ef72d42496c2b41a5149ee329802a697f0fc7446e1bacf913d7ac3901f0040288c361401b::uid::1684312765',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","index":"1-1"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload

          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      // subset
    })

    describe('Setting Type 1:: Channel does pass the notification index  3 while triggering the notification but subscribers donot have any user setting, should go with default', function () {
      // targted
      it('Channel triggers targeted notification to a non-subscriber:: should be marked as spam.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x766ce311ce8e1309438489b427e4f4d2bd47df28614d5facf94d43150ca1746042690715ae5f7ff50a30016df39dd9ae93f454f5762060b41c9d962c00c88d351c::uid::1684312917',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"3-1"},"recipients":{"0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      it('Channel triggeres targeted notification to a subscriber:: should go with default channel setting and should reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xc1397bcf7ebdae4adc1c7cb6c6f1738cea9907d03d12df549020994364a6299035a01a2e42f1ca426b4e966aaa23689413b8833b9ecb79e76cb1a30cd2eb11341c::uid::1684312860',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"3-1"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })

      it('Channel triggeres targeted notification to a subscriber:: should go with default channel setting and should reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x8569ba29441763fa786b8028c6bb303e2c0d93395edfc97eb41d94044328eeab314d74614958383aaf3f19952cdb3b9920fb12a9bd1a4dd74243d7144363932f1c::uid::1700751789',
          sender: 'eip155:11155111:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"testing range type","asub":"testing range type","type":"3","index":"3-3-5"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"testing range type","title":"testing range type"}}',
          source: 'ETH_TEST_SEPOLIA'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+3-1-4-9-1-10+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      //braodcast
      it('Channel triggers broadcast notification :: should go with default channel setting and should reach the users', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x03b4391419a0025c14133e653215ab92351b5f0011ea23476e2a6bb6ad9d812e753ce5200b078eb0b4ecbe410cd51433cee1f7b1a8e4f56bea7fbd7834acad7f1b::uid::1684312806',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","index":"3-1"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      // subset
    })

    describe('Setting Type 2:: Channel does pass the notification index  2 with value as 30 while triggering the notification but subscribers donot have any user setting', function () {
      // targted
      it('Channel triggers targeted notification to a non-subscriber:: should be marked as spam.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x2871829039a90cde1e3f30329b3e7baa774577e8f751ed7113db191eb79b82a3159172898e7c5b9a89580c2d30df47d6af385ea5300684e0ddb6816e1ea0b5d11b::uid::1684313434',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-30"},"recipients":{"0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      it('Channel triggeres targeted notification to a subscriber:: should go with default channel setting i.e. 50 and should not reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x41216d0eb0c7c28a26f41e538d75db996f298a76922133d8a3c63e5425dbae9f31d3bf01640f4bef5556b7cd3ee645831f2a22504ab3b3bda19383265ede94151c::uid::1684313485',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-30"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-0-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      //braodcast
      it('Channel triggers broadcast notification :: should go with default channel setting as 50 and should not reach the users', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x61c0d2b2e68b88f6fd8c1987428aa0c38bc6be310c0e8052bbd4c0b12a1ec11531a376db81b27954ffaf40c565a4cf18ae28365025b3070a3119a1895aade9ad1c::uid::1684313547',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","index":"2-2-30"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      // subset
    })

    describe('Setting Type 2:: Channel does pass the notification index  2 with value as 50 while triggering the notification but no user setting is set', function () {
      // targted
      it('Channel triggers targeted notification to a non-subscriber:: should be marked as spam.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xf33a5560ebfbcec6c03e86ae5c714c6ef6a47599e6473161f226b4c7d202a8dd269a8878abb9074e8108d02c8a7986cb329c4132702325451a69ab4ba77d21871b::uid::1684744280',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-50"},"recipients":{"0xD8634C39BBFd4033c0d3289C4515275102423681":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      it('Channel triggeres targeted notification to a subscriber:: should go with default channel setting i.e. 50 and should  reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x2b09ac6721c6b7157e636da7cdb283ff46ef27f4d3ad4e1f27432fded585cd2b5023f76f60657feade0a85cc0988c1d56200ac0593861cfb2f1271eb58b634c21c::uid::1684744326',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-50"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-0-50-20-100+1-1+2-1-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      //braodcast
      it('Channel triggers broadcast notification :: should go with default channel setting as 0 and should not reach the users', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x04fecd5cbc89ae786966b64beca83615f0c6e01e87a818d4ffeced5a6406bd667533b2f0dd6a73eb06da76dede4ffdc9cedfbafcd6ecaf027dd8ee031b074f171c::uid::1684744383',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","index":"2-2-50"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      // subset
    })
  })
  // Eth Channel setting with user setting . this causes the logic to pick up the use setting value
  describe('Payload Service: Test For ETH Channel setting with user setting', function () {
    describe('Channel doest not pass the notification index while triggering the notification', function () {
      // targted
      it('Channel triggers targeted notification to a non-subscriber:: should be marked as spam.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-1-20+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x41a4b064e534b7a967a578afd5428a2b17973e6bfdcfa9a209115178ba46b4e348b72727334058c565adfd0780058baaccef568978e8c397947498ef7637cb621c::uid::1684744449',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":""},"recipients":{"0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      it('Channel triggeres targeted notification to a subscriber:: it should reach the subscriber', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0-0+1-1+2-1-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-1-20+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xe5d1ca57f9b588e96f113ffc8d2e14921755cc290f51123797b993c559ae185408bb53bd3c83febdb1130b721abd53782615ce326616633ad555a3e7c4ca221c1c::uid::1684744521',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":""},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      //braodcast
      it('Channel triggers broadcast notification :: should reach all subscribers', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-1-0+1-1+2-0-0', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-1-20+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xaf54465666b0d6450e32e3dc2b45c2f1fc633c17b1e4260e34bbc7d97c54b9582e42ac203033c4f1aa6eeffa2327f5a9d453fde377555f708a178bb64d1f52da1c::uid::1684744573',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","index":""},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      // subset
    })

    describe('Setting Type 1:: Channel does pass the notification index  1 while triggering the notification with user setting is set for subscriber1 and subscriber2', function () {
      // targted
      it('Channel triggers targeted notification to a non-subscriber:: should be marked as spam.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0-0+1-1+2-1-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-1-20+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x6c1a372021220848103e8e8353f684986badd87fa90462bf4ddc83391e04614f79c6176aa2781b88349f32b49decaf164bf27605db51ab464798c5d6526427041b::uid::1684744683',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"1-1"},"recipients":{"0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      it('Channel triggers targeted notification to subscriber2:: should reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0-0+1-1+2-1-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-0-20+1-0+2-1-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xf366eecbf7c5e42995c3089b7f96f41d1c27352dcef21e18105ce500b60a99b6028af335c67fd01bf2c739a51164fe8e7d0d372e99e5adf3855091728f63f3c81c::uid::1684744728',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"1-1"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // payload._deletePayload(payloadData.verificationProof)
        }
      })

      it('Channel triggers targeted notification to subscriber2:: should reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+3-1-4-9-1-10+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0-0+3-1-1-5+2-1-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-0-20+3-0+2-1-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x1ee17da764b93061755c4c20d3d158b78841120405308877d381564ebf221ecf258cf182e433c91262df18a579569ca7a0b115c264a582dad329f5ed859d866f1b::uid::1700752921',
          sender: 'eip155:11155111:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"testing range type","asub":"testing range type","type":"1","index":"3-3-5"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"testing range type","title":"testing range type"}}',
          source: 'ETH_TEST_SEPOLIA'
        }

        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+3-1-4-9-1-10+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // payload._deletePayload(payloadData.verificationProof)
        }
      })
      it('Channel triggers targeted notification to subscriber1:: should not reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0-0+1-1+2-1-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-1-20+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xc3442a656fbb7b34593d9f587dbd263133f9088559da51d9959fb7d03f4e8595405225f428c931388ab5dad667b306679ffeec8c0c9b9248b000d0e4008b59a91b::uid::1684744848',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"1-1"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          payload._deletePayload(payloadData.verificationProof)
        }
      })
      //braodcast
      it('Channel triggers broadcast notification :: should reach subscriber2 but not subscriber1', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-20+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x6842b982c0c148e21dbe6eacd17059c1ce1fa6e57221c84c9d6f6ad97ef72d42496c2b41a5149ee329802a697f0fc7446e1bacf913d7ac3901f0040288c361401b::uid::1684744891',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","index":"1-1"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      // subset
    })

    describe('Setting Type 2:: Channel does pass the notification index  2 with value as 30 while triggering the notification with user setting is set for subscriber1 and subscriber2', function () {
      // targted
      it('Channel triggers targeted notification to a non-subscriber:: should be marked as spam.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-1-20+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x1e6f5492c078b763e029519e6a6d449110a45a3259a3770eaf7dc7b2e6291b937ef3d5c4fc36d153c0f36420af857af76d9164dea1b416be8ad23ae2eebc356a1c::uid::1686135276',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-30"},"recipients":{"0xD8634C39BBFd4033c0d3289C4515275102423681":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      it('Channel triggers targeted notification to subscriber2:: should not reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-1-10+1-1+2-1-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-0-0+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x41216d0eb0c7c28a26f41e538d75db996f298a76922133d8a3c63e5425dbae9f31d3bf01640f4bef5556b7cd3ee645831f2a22504ab3b3bda19383265ede94151c::uid::1686135376',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-30"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      it('Channel triggers targeted notification to subscriber1:: should reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-1-10+1-1+2-0-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-1-0+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x9d0383f7b894367f597051fa9e64287160eff8f18a38ab6bb49132ea00c9ae3455ffe2843d8eef915c0883dafab953e2ac60d5ce8e00bda2e5f3d8839d4977001b::uid::1686135452',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-30"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
        }
      })
      //braodcast
      it('Channel triggers broadcast notification :: should  reach subscriber1 but not subscriber2', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-1-10+1-1+2-1-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-0-0+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x61c0d2b2e68b88f6fd8c1987428aa0c38bc6be310c0e8052bbd4c0b12a1ec11531a376db81b27954ffaf40c565a4cf18ae28365025b3070a3119a1895aade9ad1c::uid::1686135507',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","index":"2-2-30"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
        }
      })
      // subset
    })
    describe('Payload Service: Test For ETH Channel setting with user setting: Eth Channel updates channelSetting from type 1 to type 2 after user subscribes to the channel', function () {
      // targted
      it('Channel triggers targeted notification to a non-subscriber:: should be marked as spam for first and should be marked as spam for 2nd notification.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-20+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x1e6f5492c078b763e029519e6a6d449110a45a3259a3770eaf7dc7b2e6291b937ef3d5c4fc36d153c0f36420af857af76d9164dea1b416be8ad23ae2eebc356a1c::uid::1684926545',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-30"},"recipients":{"0xD8634C39BBFd4033c0d3289C4515275102423681":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }

        const payloadData2 = {
          verificationProof:
            'eip712v2:0x1e6f5492c078b763e029519e6a6d449110a45a3259a3770eaf7dc7b2e6291b937ef3d5c4fc36d153c0f36420af857af76d9164dea1b416be8ad23ae2eebc356a1c::uid::1684926545123',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-30"},"recipients":{"0xD8634C39BBFd4033c0d3289C4515275102423681":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting,
            '3+1-0+2-0+1-1+2-98'
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting,
            '3+1-1+2-20+1-0+2-0'
          )

          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
          // channel changes its setting
          await channelClass.addChannelSettings(
            channel,
            '4+2-50-20-100+1-0+1-1+2-78-10-150',
            'test1v2+test2v2+test3v2+test4v2'
          )
          const newResponse = await payload.addExternalPayload(
            payloadData2.verificationProof,
            channel,
            0,
            payloadData2.recipient,
            payloadData2.source,
            payloadData2.identity
          )
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
          // await payload._deletePayload(payloadData2.verificationProof)
        }
      })
      it('Channel triggers targeted notification to a subscriber2:: first notification should reach subscriber2 but second notification should not.', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0-0+1-1+2-1-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-1-10+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x41216d0eb0c7c28a26f41e538d75db996f298a76922133d8a3c63e5425dbae9f31d3bf01640f4bef5556b7cd3ee645831f2a22504ab3b3bda19383265ede94151c::uid::1684926598',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-30"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }

        const payloadData2 = {
          verificationProof:
            'eip712v2:0xa65ab137c195e8881e0bae65108e9938183b84e39d09aa9bfeaf12fbc81a7384625df0a3f8317b0f7fdd4bef1fbc2b5b9b35b6dccd8b871c429bc3ce3b0a71701b::uid::1686136483',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-1"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-1-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          // const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          // channel changes its setting
          await channelClass.addChannelSettings(
            channel,
            '4+2-1-50-20-100+1-0+1-1+2-0-78-10-150',
            'test1v2+test2v2+test3v2+test4v2'
          )

          const newResponse = await payload.addExternalPayload(
            payloadData2.verificationProof,
            channel,
            0,
            payloadData2.recipient,
            payloadData2.source,
            payloadData2.identity
          )
          expect(newResponse).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
          // await payload._deletePayload(payloadData2.verificationProof)
        }
      })
      it('Channel triggers targeted notification to subscriber1:: first and second notification should not reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0-0+1-1+2-1-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-1-10+1-0+2-0-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x9d0383f7b894367f597051fa9e64287160eff8f18a38ab6bb49132ea00c9ae3455ffe2843d8eef915c0883dafab953e2ac60d5ce8e00bda2e5f3d8839d4977001b::uid::1686136950',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-2-30"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }

        const payloadData2 = {
          verificationProof:
            'eip712v2:0x37913bd1ffb0e72ae49286db71e74883977648f536a5959e7374b205812ecc640bb0457e6f068625521c7d33536cb96a61517fa3af039d76fbf26d4a19af96301b::uid::1686137051',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","index":"2-1"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-1-50-20-100+1-1+2-0-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload

          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
          await channelClass.addChannelSettings(
            channel,
            '4+2-1-50-20-100+1-0+1-1+2-0-78-10-150',
            'test1v2+test2v2+test3v2+test4v2'
          )

          const newResponse = await payload.addExternalPayload(
            payloadData2.verificationProof,
            channel,
            0,
            payloadData2.recipient,
            payloadData2.source,
            payloadData2.identity
          )
          expect(newResponse).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
          // await payload._deletePayload(payloadData.verificationProof)
          // await payload._deletePayload(payloadData2.verificationProof)
        }
      })
      //braodcast
      it('Channel triggers broadcast notification :: should  reach subscriber2 but not subscriber1', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-30+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const payload = Container.get(payloadService)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x61c0d2b2e68b88f6fd8c1987428aa0c38bc6be310c0e8052bbd4c0b12a1ec11531a376db81b27954ffaf40c565a4cf18ae28365025b3070a3119a1895aade9ad1c::uid::1686137746',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","index":"2-2-30"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        const payloadData2 = {
          verificationProof:
            'eip712v2:0x6ee385802291bee2dac9f30b7c349af13094d092f518216e4ec61de715145433631e35c0f961092124dcf1c9dc4143ba2566e551ad74725e34053c5676c460d61c::uid::1686137444',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","index":"2-1"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            null,
            null
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            null,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            channel,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
          await channelClass.addChannelSettings(
            channel,
            '4+2-50-20-100+1-0+1-1+2-78-10-150',
            'test1v2+test2v2+test3v2+test4v2'
          )
          const newResponse = await payload.addExternalPayload(
            payloadData2.verificationProof,
            channel,
            0,
            payloadData2.recipient,
            payloadData2.source,
            payloadData2.identity
          )
          expect(newResponse).to.be.true
        } catch (err) {
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber1)
          await subscriberClass._deleteSubscriber(channel, subscriber2)
          await payload._deletePayload(payloadData.verificationProof)
          await payload._deletePayload(payloadData2.verificationProof)
        }
      })
    })
  })

  // Alias Channel setting but no user setting . this causes the logic to pick up the default value instead
  describe.skip('Payload Service: Test For Alias Channel with setting but no user setting', function () {
    describe('Alias doest not pass the notification index while triggering the notification', function () {
      // targted
      it('Alias triggers targeted notification to a non-subscriber:: should be marked as spam.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const payloadData = {
          verificationProof:
            'eip712v2:0x0c8047319ffa3ca3c95e941173d2c8bee57beab7b752f56b9310f2ea2c0d1f5f512ad3163f965a8ce6e64ec25ea7f1a81cb825824fbc533d45f98e3b95ae79fd1b::uid::1683694791',
          sender: 'eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d',
          recipient: 'eip155:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":""},"recipients":{"0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      it('Alias triggers targeted notification to a non-subscriber:: should not marked as spam.', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x84244bbebe2eaa6c661a72cc4f23152f371d84620424bded52729405cc6e1bf73c35860f2c6214307994ed5ebe79d6869d821d3ed07e9695d384a38c970d0d131c::uid::1683695782',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":""},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      //braodcast
      it('Alias triggers broadcast notification :: should reach all subscribers', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const payloadData = {
          verificationProof:
            'eip712v2:0x67386e48a5c61b1a7e2d3d7d1df8146232dca9af5286f6903b4c886e314a386409ce61ad8ded344825a348d999ca371177282c0970b7a0e553e96f51319549121b::uid::1683694942',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","settingIndex":""},"recipients":{"0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass._verifyChannelAlias(channel)
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      // subset
    })

    describe('Setting Type 1:: Alias does pass the notification index  1 while triggering the notification but no user setting is set', function () {
      // targted
      it('Alias triggers targeted notification to a non-subscriber:: should be marked as spam.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const payloadData = {
          verificationProof:
            'eip712v2:0x93429fe6fae207d1758c576c57f8fae16ea1ca4d614b87ce9459ec7986651b0101ea96f056d26fbb22e6744f02f0b93cf8c9c9c269a761f1188d5fd9b366e95e1b::uid::1683697147',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"1-1"},"recipients":{"0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      it('Alias triggers targeted notification to a subscriber:: should go with default and should not reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const payloadData = {
          verificationProof:
            'eip712v2:0x3809551f5a366426fb7caf691d662ac840100b0d03e1e3d62238b57217f61405517bfdab9d9bb7d80918fa9a097c0a8cebf0686c107b75641f7e63cb664ca99d1c::uid::1683697286',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"1-1"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      //braodcast
      it('Alias triggers broadcast notification :: should go with default and should not reach the user', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x5b7842eeb74d52462f7b76bbd2acd946e47496b3e5bc10901b57f7b85ec683194d80ab865169bf385456e366efdc02f61ad326f36da3c76fd039b52b4b0dd5fe1c::uid::1683697381',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","settingIndex":"1-1"},"recipients":{"0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      // subset
    })

    describe('Setting Type 1:: Alias does pass the notification index  3 while triggering the notification but no user setting is set', function () {
      // targted
      it('Alias triggers targeted notification to a non-subscriber:: should be marked as spam.', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const payloadData = {
          verificationProof:
            'eip712v2:0xd64f075cb2959cd75c70001d1c1c0bfa36779bbb6c86e7319ca00a4da5c68f5573035b6068baac41c819b94a10eec477bb6d732a80f8f87bb40acf26c96225f21b::uid::1683697672',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"3-1"},"recipients":{"0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }

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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      it('Alias triggers targeted notification to a subscriber:: should go with default and should reach the user', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xb7c2b8555e405bacdefc9183a0f78e8056aca972b3d3efccb6a52b006e9113cd2edf19e5cb02d850b1aa5083a9b8d8bad7622634cad30463785f53a9e322e0701b::uid::1683697870',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"3-1"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      //braodcast
      it('Alias triggers broadcast notification :: should go with default and should reach the users', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x2222867fd4b58a64b1b7c83efb9b72f71c9ddafb03668a60abd4fe172984c598144ebd6acd93be531330df2af92f828b514f01be478d4110e25997c51c1a72d51b::uid::1683698033',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","settingIndex":"3-1"},"recipients":{"0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      // subset
    })

    describe('Setting Type 2:: Alias does pass the notification index  2 with value as 30 while triggering the notification but no user setting is set', function () {
      // targted
      it('services/payloadService:: channel setting -> present: user setting -> null : notification type -> target: non-subscriber', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x157e768249fa632d2b9319ef5d2bc047b6fe0aa85c0cc6e5fa52d5fbc2691175378edb329e4cd9356960d3d5441ae3c35e37628e489932d15fde817be9752b621b::uid::1683698726',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"2-2-30"},"recipients":{"0xD8634C39BBFd4033c0d3289C4515275102423681":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      it('services/payloadService:: channel setting -> present : user setting -> null : notification type -> target: subscriber', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x26beb357f9f7aef46c5dfedaa30321da3aa007ea7bf1efe7bce49494166edf626f0c4a85a5b5cb3d8f1676055871f0cafdda41e23c08857405303f95a4c75cf31c::uid::1683698899',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"2-2-30"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      //braodcast
      it('services/payloadService:: channel setting -> present: notification type -> broadcast', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x74742ef97394c9aca31d2feb3de4e1f2bf31dab2386b1ba7a9a43b4f9d06adc5171b5e3586f735e5e502b06cf367a2a0071e533edd8bde4e5ab5e021f7ef27fe1c::uid::1683698981',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","settingIndex":"2-2-30"},"recipients":{"0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      // subset
    })

    describe('Setting Type 2:: Alias does pass the notification index  2 with value as 50 while triggering the notification but no user setting is set', function () {
      // targted
      it('services/payloadService:: channel setting -> present: user setting -> null : notification type -> target: non-subscriber', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xe74be76864e8082b122c14466ebcee2402d24eb723d5af008f49cfd861c1417e0a09034b53f4bd79ff0696e8d560d81e63937276279fe6d7a1bcb2a7d97bef721b::uid::1683699231',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"2-2-50"},"recipients":{"0xD8634C39BBFd4033c0d3289C4515275102423681":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      it('services/payloadService:: channel setting -> present : user setting -> null : notification type -> target: subscriber', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xb1f94fd4fe80fe8557f40d186703cf1aef2c53ac8ad7c5e6071ccce1491bfe8c2040d55461aeb3fb95dbc7981dba8182a6e93a2a6f8be68dbbbc47eeb6ecf2a81c::uid::1683699450',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"2-2-50"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await channelClass._verifyChannelAlias(channel)
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      //braodcast
      it('services/payloadService:: channel setting -> present: notification type -> broadcast', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const aliasAddress = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xfa62c1bcfe6e34387dd9e0456d1f7533b326e937886371c6819b18cbeab2cf030dea2e5837fdef934c85dbd472d88d4dbdba0da1edc9d4d8598ac7ca94787d5f1b::uid::1683699596',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","settingIndex":"2-2-50"},"recipients":{"0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
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
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            null
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      // subset
    })
  })
  // Alias Channel setting with user setting . this causes the logic to pick up the use setting value
  describe.skip('Payload Service: Test For Alias Channel setting with user setting', function () {
    describe('Alias doest not pass the notification index while triggering the notification', function () {
      // targted
      it('services/payloadService:: channel setting -> present: user setting -> null : notification type -> target: non-subscriber', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-20+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const payloadData = {
          verificationProof:
            'eip712v2:0x0c8047319ffa3ca3c95e941173d2c8bee57beab7b752f56b9310f2ea2c0d1f5f512ad3163f965a8ce6e64ec25ea7f1a81cb825824fbc533d45f98e3b95ae79fd1b::uid::1683716375',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":""},"recipients":{"0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      it('services/payloadService:: channel setting -> present : alias pass notification index : notification type -> target: subscriber2', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-30+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const payloadData = {
          verificationProof:
            'eip712v2:0x84244bbebe2eaa6c661a72cc4f23152f371d84620424bded52729405cc6e1bf73c35860f2c6214307994ed5ebe79d6869d821d3ed07e9695d384a38c970d0d131c::uid::1683716433',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":""},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      //braodcast
      it('services/payloadService:: channel setting -> present: notification type -> broadcast', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-20+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x64e97f2671ae5fbb297db2abb04aa617e9e401e22102499aa5fa49f1f095cddf6bf7a1c08d305618ad97c7d7a1d3e9b33ae53913cec5e4b07f6c5826783da0151b::uid::1683701150',
          sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","settingIndex":""},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'ETH_TEST_GOERLI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      // subset
    })

    describe('Setting Type 1:: Alias does pass the notification index  1 while triggering the notification with user setting is set for subscriber1 and subscriber2', function () {
      // targted
      it('services/payloadService:: channel setting -> present: user setting -> null : notification type -> target: non-subscriber', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-20+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x93429fe6fae207d1758c576c57f8fae16ea1ca4d614b87ce9459ec7986651b0101ea96f056d26fbb22e6744f02f0b93cf8c9c9c269a761f1188d5fd9b366e95e1b::uid::1683717066',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"1-1"},"recipients":{"0xd26a7bf7fa0f8f1f3f73b056c9a67565a6afe63c":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      it('services/payloadService:: channel setting -> present : user setting -> null : notification type -> target: subscriber2', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-20+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x3809551f5a366426fb7caf691d662ac840100b0d03e1e3d62238b57217f61405517bfdab9d9bb7d80918fa9a097c0a8cebf0686c107b75641f7e63cb664ca99d1c::uid::1683717431',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"1-1"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      it('services/payloadService:: channel setting -> present : user setting -> null : notification type -> target: subscriber1', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-20+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xf62bbcc6c22ce08dd34f19068572f00eab1808655badfaae3fc516b78cc5ee702884b60b87da73c6f071fdd86940cd7de8a8bd44a4660053d5adc00478fcf5f91b::uid::1683717519',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"1-1"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      //braodcast
      it('services/payloadService:: channel setting -> present: notification type -> broadcast', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-20+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x5b7842eeb74d52462f7b76bbd2acd946e47496b3e5bc10901b57f7b85ec683194d80ab865169bf385456e366efdc02f61ad326f36da3c76fd039b52b4b0dd5fe1c::uid::1683717765',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","settingIndex":"1-1"},"recipients":{"0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      // subset
    })

    describe('Setting Type 2:: Alias does pass the notification index  2 with value as 30 while triggering the notification with user setting is set for subscriber1 and subscriber2', function () {
      // targted
      it('services/payloadService:: channel setting -> present: user setting -> null : notification type -> target: non-subscriber', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-30+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x157e768249fa632d2b9319ef5d2bc047b6fe0aa85c0cc6e5fa52d5fbc2691175378edb329e4cd9356960d3d5441ae3c35e37628e489932d15fde817be9752b621b::uid::1683718071',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"2-2-30"},"recipients":{"0xD8634C39BBFd4033c0d3289C4515275102423681":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      it('services/payloadService:: channel setting -> present : user setting -> null : notification type -> target: subscriber1', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-0+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-30+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0xd73f4bd59109e9ec0b513a6564b362a9c8f4953d53c98f7f9b01c953b21e04d62dc2ba59d415c41795438b8222b9023cdd51664e354d503e5cc8c62424c5f1c81b::uid::1683718204',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"2-2-30"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      it('services/payloadService:: channel setting -> present : user setting -> null : notification type -> target: subscriber2', async function () {
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-10+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-30+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x26beb357f9f7aef46c5dfedaa30321da3aa007ea7bf1efe7bce49494166edf626f0c4a85a5b5cb3d8f1676055871f0cafdda41e23c08857405303f95a4c75cf31c::uid::1683718325',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"3","settingIndex":"2-2-30"},"recipients":{"0xfFA1aF9E558B68bBC09ad74058331c100C135280":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      //braodcast
      it('services/payloadService:: channel setting -> present: notification type -> broadcast', async function () {
        // create a dummy channel with no notification setting
        const channel = `${ETH_CAIP}:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const aliasChannel = `eip155:80001:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const channelSetting = utilsHelper.parseChannelSetting(
          '4+1-0+2-50-20-100+1-1+2-78-10-150',
          'test1+test2+test3+test4'
        )
        const subscriber1 = `eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029`
        const subscriber1Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-0+2-10+1-1+2-98', channelSetting)
        )
        const subscriber2 = `eip155:0xfFA1aF9E558B68bBC09ad74058331c100C135280`
        const subscriber2Setting = JSON.stringify(
          utilsHelper.parseUserSetting('3+1-1+2-30+1-0+2-0', channelSetting)
        )
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        const payloadData = {
          verificationProof:
            'eip712v2:0x74742ef97394c9aca31d2feb3de4e1f2bf31dab2386b1ba7a9a43b4f9d06adc5171b5e3586f735e5e502b06cf367a2a0071e533edd8bde4e5ab5e021f7ef27fe1c::uid::1683718598',
          sender: 'eip155:80001:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D',
          recipient: 'eip155:0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d',
          identity:
            '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"","type":"1","settingIndex":"2-2-30"},"recipients":{"0xc5fb3741e5a7a41bf9126abcbbe984abfe92a99d":null},"notification":{"body":"test subset","title":""}}',
          source: 'POLYGON_TEST_MUMBAI'
        }
        try {
          await channelClass._deleteChannel(channel, identity)
          await channelClass.addChannel(channel, channelType, identity)
          await channelClass._populateChannelData(
            channel,
            channel_name,
            channel_info,
            channel_url,
            channel_icon,
            aliasChannel,
            '80001'
          )
          await channelClass._verifyChannelAlias(channel)
          await channelClass.addChannelSettings(
            channel,
            '4+1-0+2-50-20-100+1-1+2-78-10-150',
            'test1+test2+test3+test4'
          )
          // subscribe an address to the channel
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber1,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber1Setting
          )
          await subscriberClass.subscribeTo(
            channel,
            aliasChannel,
            subscriber2,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof,
            subscriber2Setting
          )
          // add payload
          const payload = Container.get(payloadService)
          const response = await payload.addExternalPayload(
            payloadData.verificationProof,
            payloadData.sender,
            0,
            payloadData.recipient,
            payloadData.source,
            payloadData.identity
          )
          await payload.batchProcessPayloads()
          expect(response).to.be.true
        } catch (err) {
        } finally {
          // await channelClass._deleteChannel(channel, identity)
          // await subscriberClass._deleteSubscriber(channel, subscriber1)
          // await subscriberClass._deleteSubscriber(channel, subscriber2)
        }
      })
      // subset
    })
  })
})

describe('Payload Simulate Testcases', () => {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  describe('Test for simlate payload', () => {
    it.skip('should send test notification', async () => {
      const data = {
        verificationProof:
          'eip712v2:0x73c060f70b881758e17df75ec4ecc7b9ec7214ecfdcd1402386bea5f3fa780de4e75f55afc1769e95e24a117dbf25dc81d8af6b3e94df3e6093ce5575210b5531b::uid::1699003270',
        sender: 'eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        recipient: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        identity:
          '2+{"data":{"acta":"","aimg":"","amsg":"test subset","asub":"testing simulate","type":"3"},"recipients":{"0x69e666767Ba3a661369e1e2F572EdE7ADC926029":null},"notification":{"body":"test simulate","title":"test simulate"}}',
        source: 'SIMULATE'
      }
      const payload = Container.get(payloadService)
      const response = await payload.addExternalPayload(
        data.verificationProof,
        data.sender,
        0,
        data.recipient,
        data.source,
        data.identity
      )
    })
  })
})
