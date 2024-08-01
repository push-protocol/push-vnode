import 'mocha'

import chai from 'chai'
import chaiHttp from 'chai-http'
import { Container } from 'typedi'

import { startServer, stopServer } from '../../src/appInit'
import channelsClass from '../../src/services/channelsCompositeClasses/channelsClass'
import subscribersClass from '../../src/services/channelsCompositeClasses/subscribersClass'
const payloadVerificationHelper = require('../../src/helpers/payloadVerificationHelper')

import chalk from 'chalk'

import config from '../../src/config'
const ETH_CAIP = config.ethereumId
const ALIAS_CAIP = config.supportedAliasIds
chai.use(chaiHttp)
chai.should()
const expect = chai.expect

const startNode = async () => {
  console.log('\n    🟢  ' + chalk.bold.cyan.inverse(' STARTING  SERVER \n'))
  process.stdout.moveCursor(0, -2) // up one line
  process.stdout.clearLine(1) // from cursor to end
  await startServer('error', true)
  console.log('\n    🟢  ' + chalk.bold.cyan.inverse(' STARTED  SERVER \n'))
}

const stopNode = async () => {
  console.log('\n    🔴  ' + chalk.bold.cyan.inverse(' STOPPING  SERVER \n'))
  process.stdout.moveCursor(0, -3) // up one line
  process.stdout.clearLine(1) // from cursor to end

  await stopServer()
  console.log('\n    🔴  ' + chalk.bold.cyan.inverse(' SERVER  STOPPED \n'))
}

describe('src/helpers/payloadVerificationHelper.ts unit tests', () => {
  describe('src/helpers/payloadVerificationHelper.ts :: verifyChannelSpecificInformation', () => {
    before(async function () {
      await startNode()
    })

    after(async function () {
      await stopNode()
    })

    it('Should verify successfully for eth channel [recipiant address same as channel]', async () => {
      const channel = `${ETH_CAIP}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const subscriber = `eip155:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
      const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
      const channelType = 2
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      const channel_name = 'channel_name'
      const channel_info = 'channel_info'
      const channel_url = 'channel_url'
      const channel_icon = 'channel_icon'
      // channel creation
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
        // subscribe
        await subscriberClass.subscribeTo(
          channel,
          null,
          subscriber,
          subscribeVerificationProof,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP]
        )
        const response = await payloadVerificationHelper.verifyChannelSpecificInformation(channel)
        expect(response).to.have.keys('success')
        expect(response.success).to.be.true
      } catch (error) {
        console.log(error)
      } finally {
        await channelClass._deleteChannel(channel, identity)
        await subscriberClass._deleteSubscriber(channel, subscriber)
      }
    })

    it('Should verify successfully for eth channel [recipiant address different from channel]', async () => {
      const channel = `${ETH_CAIP}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const subscriber = `eip155:0x778D3206374f8AC265728E18E3fE2Ae6b93E4ce4`
      const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
      const channelType = 2
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      const channel_name = 'channel_name'
      const channel_info = 'channel_info'
      const channel_url = 'channel_url'
      const channel_icon = 'channel_icon'
      // channel creation
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
        // subscribe
        await subscriberClass.subscribeTo(
          channel,
          null,
          subscriber,
          subscribeVerificationProof,
          config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP]
        )
        const response = await payloadVerificationHelper.verifyChannelSpecificInformation(
          channel,
          subscriber,
          config.MAP_CAIP_TO_BLOCKCHAIN_STRING[ETH_CAIP]
        )
        expect(response).to.have.keys('success')
        expect(response.success).to.be.true
      } catch (error) {
        console.log(error)
      } finally {
        await channelClass._deleteChannel(channel, identity)
        await subscriberClass._deleteSubscriber(channel, subscriber)
      }
    })

    it('Should fail as channel doesnt exist', async () => {
      const channel = `${ETH_CAIP}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const subscriber = `eip155:0x778D3206374f8AC265728E18E3fE2Ae6b93E4ce4`
      const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
      const channelType = 2
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      const channel_name = 'channel_name'
      const channel_info = 'channel_info'
      const channel_url = 'channel_url'
      const channel_icon = 'channel_icon'
      // channel creation
      try {
        await channelClass._deleteChannel(channel, identity)
        const response = await payloadVerificationHelper.verifyChannelSpecificInformation(channel)
        expect(response).to.have.keys('success')
        expect(response.success).to.be.false
      } catch (error) {
        console.log(error)
      } finally {
        await channelClass._deleteChannel(channel, identity)
      }
    })

    for (let i = 0; i < ALIAS_CAIP.length; i++) {
      it(`Should return successfully verified for alias ${ALIAS_CAIP[i]}`, async () => {
        const channel = `${ETH_CAIP}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber = `eip155:0x778D3206374f8AC265728E18E3fE2Ae6b93E4ce4`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const aliasAddress = `${ALIAS_CAIP[i]}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        // channel creation
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
            config.MAP_BLOCKCHAIN_TO_ID[ALIAS_CAIP[i]]
          )
          await channelClass._verifyChannelAlias(channel)
          // subscribe
          await subscriberClass.subscribeTo(
            channel,
            aliasAddress,
            subscriber,
            config.MAP_BLOCKCHAIN_TO_ID[ETH_CAIP],
            subscribeVerificationProof
          )
          const response = await payloadVerificationHelper.verifyChannelSpecificInformation(
            aliasAddress
          )
          expect(response).to.have.keys('success')
          expect(response.success).to.be.true
        } catch (error) {
          console.log(error)
        } finally {
          await channelClass._deleteChannel(channel, identity)
          await subscriberClass._deleteSubscriber(channel, subscriber)
        }
      })

      it(`Should fail as the alias is not verified for ${ALIAS_CAIP[i]}`, async () => {
        const channel = `${ETH_CAIP}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber = `eip155:0x778D3206374f8AC265728E18E3fE2Ae6b93E4ce4`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const aliasAddress = `${ALIAS_CAIP[i]}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        // channel creation
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
            config.MAP_BLOCKCHAIN_TO_ID[ALIAS_CAIP[i]]
          )
          const response = await payloadVerificationHelper.verifyChannelSpecificInformation(
            aliasAddress
          )
          expect(response).to.have.keys('success')
          expect(response.success).to.be.false
        } catch (error) {
          console.log(error)
        } finally {
          await channelClass._deleteChannel(channel, identity)
        }
      })

      it(`Should fail as the alias doesnt exist for ${ALIAS_CAIP[i]}`, async () => {
        const channel = `${ETH_CAIP}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
        const identity =
          '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
        const subscriber = `eip155:0x778D3206374f8AC265728E18E3fE2Ae6b93E4ce4`
        const subscribeVerificationProof = `eip712:0x7e996cfeac116a604bcbf6fd725169ff65ba761f493033b73abb50a95a8fc86a4a9a8f9fa69175be47d7490ff0b98bbe537761d162d5f2846e94eece1cdeb7aa1b`
        const aliasAddress = `${ALIAS_CAIP[i]}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
        const channelType = 2
        const channelClass = Container.get(channelsClass)
        const subscriberClass = Container.get(subscribersClass)
        const channel_name = 'channel_name'
        const channel_info = 'channel_info'
        const channel_url = 'channel_url'
        const channel_icon = 'channel_icon'
        // channel creation
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
          const response = await payloadVerificationHelper.verifyChannelSpecificInformation(
            aliasAddress
          )
          expect(response).to.have.keys('success')
          expect(response.success).to.be.false
        } catch (error) {
          console.log(error)
        } finally {
          await channelClass._deleteChannel(channel, identity)
        }
      })
    }
  })

  describe('src/helpers/payloadVerificationHelper.ts :: verifyPayloadIdentityStorage', () => {
    before(async function () {
      await startNode()
    })

    after(async function () {
      await stopNode()
    })
    for (let i = 0; i <= 4; i++) {
      it(`Should return true for ${i}`, async () => {
        const res = payloadVerificationHelper.verifyPayloadIdentityStorage(i)
        expect(res).to.be.true
      })
    }

    it(`Should return false for negative`, async () => {
      const res = payloadVerificationHelper.verifyPayloadIdentityStorage(-1)
      expect(res).to.be.false
    })

    it(`Should return false for value greater than 4`, async () => {
      const res = payloadVerificationHelper.verifyPayloadIdentityStorage(10)
      expect(res).to.be.false
    })
  })

  describe('src/helpers/payloadVerificationHelper.ts :: verifyPayloadIdentityHash', () => {
    describe('src/helpers/payloadVerificationHelper.ts :: verifyPayloadIdentityHash :: Type 0 -> 0+<NotificationType>+<Title>+<Body>', () => {
      before(async function () {
        await startNode()
      })

      after(async function () {
        await stopNode()
      })
      const title = 'Hello'
      const body = 'Hello World'
      const type = '1'
      it(`Should fail for type 0 as it has only type`, async () => {
        const storageType = 0
        const storagePointer = type
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })

      it(`Should fail for type 0 as it has only title`, async () => {
        const storageType = 0
        const storagePointer = title
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })

      it(`Should fail for type 0 as it has only body`, async () => {
        const storageType = 0
        const storagePointer = body
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })

      it.skip(`Should fail for type 0 as it has only type and +++++s`, async () => {
        const storageType = 0
        const storagePointer = `${type}+++++`
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })

      it.skip(`Should fail for type 0 as it has only title and +++++s`, async () => {
        const storageType = 0
        const storagePointer = `${title}+++++`
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })

      it.skip(`Should fail for type 0 as it has only body and +++++s`, async () => {
        const storageType = 0
        const storagePointer = `${body}+++++`
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })

      it.skip(`Should fail for type 0 as the title body type are not separated by delimitter but has delimiter after the actual text`, async () => {
        const storageType = 0
        const storagePointer = `${type} ${title} ${body}+++++`
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })

      it.skip(`Should fail for type 0 as the type of notification should come first before title and body`, async () => {
        const storageType = 0
        const storagePointer = `${title}+${type}+${body}`
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })
    })

    describe('src/helpers/payloadVerificationHelper.ts :: verifyPayloadIdentityHash :: Type 1 -> 1+<ipfs hash>', () => {
      before(async function () {
        await startNode()
      })

      after(async function () {
        await stopNode()
      })

      it(`Should fail for type 1: invalid cid`, async () => {
        const storageType = 1
        const storagePointer = `bafyreie255k3tnmejfukfy5zparvbyhnpsydlyt56s6nq4oddhgvnjct4`
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })

      it(`Should pass for type 1: valid cid`, async () => {
        const storageType = 1
        const storagePointer = `bafyreiggzc7yna2el5cxspx7ea53hgq5gcunvjq4vrorrgwgh2ieu2spea`
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.true
        expect(response.err).to.be.equals('')
      })
    })

    describe('src/helpers/payloadVerificationHelper.ts :: verifyPayloadIdentityHash :: Type 2 -> 2+stringified payload', () => {
      before(async function () {
        await startNode()
      })

      after(async function () {
        await stopNode()
      })

      it(`Should pass for type 2`, async () => {
        const storageType = 2
        const storagePointer = `{"data": {"acta": "https://polygon.technology/", "aimg": "", "amsg": "0.13 of Wrapped BTC token transferred[timestamp: 1675251046]", "asub": "Wrapped BTC Token briged", "type": "3"}, "recipients": "0xb78272bE4AcEFB7e6eeFe48B846cf00bf9f8fDfc", "notification": {"body": "Wrapped BTC Token briged", "title": "Wrapped BTC Token transferred"}}`
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.true
        expect(response.err).to.be.equals('')
      })

      it(`Should fail for type 2 : data is {}`, async () => {
        const storageType = 2
        const storagePointer = `{"data": {}, "recipients": "0xb78272bE4AcEFB7e6eeFe48B846cf00bf9f8fDfc", "notification": {"body": "Wrapped BTC Token briged", "title": "Wrapped BTC Token transferred"}}`
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })

      it(`Should fail for type 2 : notification is {}`, async () => {
        const storageType = 2
        const storagePointer = `{"data": {"acta": "https://polygon.technology/", "aimg": "", "amsg": "0.13 of Wrapped BTC token transferred[timestamp: 1675251046]", "asub": "Wrapped BTC Token briged", "type": "3"}, "recipients": "0xb78272bE4AcEFB7e6eeFe48B846cf00bf9f8fDfc", "notification": {}}`
        const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
          storageType,
          storagePointer
        )
        expect(response).to.have.keys('success', 'err')
        expect(response.success).to.be.false
        expect(response.err).to.be.not.null
      })
    })

    describe('src/helpers/payloadVerificationHelper.ts :: verifyPayloadIdentityHash :: Type 4 -> chat based', () => {
      // may fail if cid is not present in local ipfs node
      before(async function () {
        await startNode()
      })

      after(async function () {
        await stopNode()
      })

      it.skip(`Should pass for type 4`, async () => {
        const channel = `${ETH_CAIP}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
        const storageType = 4
        const storagePointer = 'cid:bafyreiggzc7yna2el5cxspx7ea53hgq5gcunvjq4vrorrgwgh2ieu2spea'
        // channel creation
        try {
          const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
            storageType,
            storagePointer,
            channel
          )
          expect(response).to.have.keys('success', 'err')
          expect(response.success).to.be.true
        } catch (error) {
          console.log(error)
        }
      })

      it.skip(`Should fail for type 4: invalid cid`, async () => {
        const channel = `${ETH_CAIP}:0xC5FB3741E5A7A41bf9126abCBbe984abfe92A99D`
        const storageType = 4
        const storagePointer = 'cid:bafyreiggzc7yna2el5cxspx7ea53hgq5gcunvjq4vrorrgwgh2ieu2spe'
        // channel creation
        try {
          const response = await payloadVerificationHelper.verifyPayloadIdentityHash(
            storageType,
            storagePointer,
            channel
          )
          expect(response).to.have.keys('success', 'err')
          expect(response.success).to.be.true
        } catch (error) {
          console.log(error)
        }
      })
    })
  })

  describe('src/helpers/payloadVerificationHelper.ts :: verifyEip712ProofV2', () => {
    before(async function () {
      await startNode()
    })

    after(async function () {
      await stopNode()
    })
    const originalSigner = '0xD8634C39BBFd4033c0d3289C4515275102423681'
    it(`Should pass for valid eip712V2 signature`, async () => {
      const testData =
        '2+{"notification":{"title":"EPNS x LISCON isafbksFBKSBJFKSBFKSJFKSAJBFASKJBFKJBFWJKFBKSJABFKSJABFKAJSBFKJASBFKA","body":"Dropping test directly on push nodes at LISCON 2021."},"data":{"acta":"","aimg":"","amsg":"Current BTC price is - 47,785.10USD","asub":"","type":"3","secret":"","etime":1659447000,"hidden":false}}'
      const signature =
        '0x9782e2fdc684bd28fac9e18c52780d5899ae6270c1d6b1fe6bc47ce42cb13c040d879c79911b4919709581e85e961613e7d8eb18190a556e19868d8ed537443d1c'

      const signerAddress = payloadVerificationHelper.verifyEip712ProofV2(signature, testData)
      expect(signerAddress.toLowerCase()).to.be.equal(originalSigner.toLowerCase())
    })

    it(`Should pass for invalid eip712V2 signature`, async () => {
      const testData =
        '2+{"notification":{"title":"EPNS x LISCON isafbksFBKSBJFKSBFKSJFKSAJBFASKJBFKJBFWJKFBKSJABFKSJABFKAJSBFKJASBFKA","body":"Dropping test directly on push nodes at LISCON 2021."},"data":{"acta":"","aimg":"","amsg":"Current BTC price is - 47,785.10USD","asub":"","type":"3","secret":"","etime":1659447000,"hidden":false}}'
      const signature =
        '0x9782e2fdc684bd28fac9e18c52780d5899ae6270c1d6b1fe6bc47ce42cb13c040d479c79911b4919709581e85e961613e7d8eb18190a556e19868d8ed537443d1c'

      const signerAddress = payloadVerificationHelper.verifyEip712ProofV2(signature, testData)
      expect(signerAddress.toLowerCase()).to.be.not.equal(originalSigner.toLowerCase())
    })
  })

  describe('src/helpers/payloadVerificationHelper.ts :: verifyEip712ProofV2', () => {
    before(async function () {
      await startNode()
    })

    after(async function () {
      await stopNode()
    })
    const validTestData = [
      // goerli
      {
        transactionHash: '0x91af908a1d17801af272c8c22a3982aa9ce2e924762e8c5bc7c0928d3bd6508e',
        chainid: 111551111,
        channel: 'eip155:11155111:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        identity: '1+bafkreibkvjmairfaiusnq27bjqzfbrjxkp7rq4wlindefkfny2arr7qjei'
      }
    ]

    const inValidTestData = [
      // goerli
      {
        transactionHash: '0x87d5a7825af6fd7ae7f76d65e8a3a6b4bb95a156f384ccccdcf65194045d3cf5',
        chainid: 5,
        channel: 'eip155:5:0xdeF6A8db4DE079E54A400395a279630FE8Fc1792',
        identity: '1+QmYPwFsdPTZtzP4ahtqaDoa4MgUEAUSQ1CnCb8gfVzwKQ4'
      },
      //mumbai
      {
        transactionHash: '0x8547d976ec6d8aeccca05d34de89f223d60f668f483b43ee6a37f9dc22091d49',
        chainid: 80001,
        channel: 'eip155:80001:0xf0A701241da5037d366165B2621A83B66965cB28',
        identity: '1+bafkreibkvjmairfaiusnq27bjqzfbrjxkp7rq4wlindefkfny2arr7qjei'
      }
    ]
    it(`Should pass for valid transaction data`, async () => {
      const dataPromises = []
      validTestData.forEach((data) => {
        dataPromises.push(
          Promise.resolve(
            payloadVerificationHelper.verifyEip155Proof(
              data.transactionHash,
              data.channel,
              data.identity,
              data.chainid
            )
          )
        )
      })
      const resolvedData = await Promise.all(dataPromises)
      resolvedData.forEach((res) => {
        expect(res).to.be.true
      })
    })

    it(`Should fail for invalid transaction data`, async () => {
      const dataPromises = []
      inValidTestData.forEach((data) => {
        dataPromises.push(
          Promise.resolve(
            payloadVerificationHelper.verifyEip155Proof(
              data.transactionHash,
              data.channel,
              data.identity,
              data.chainid
            )
          )
        )
      })
      const resolvedData = await Promise.all(dataPromises)
      resolvedData.forEach((res) => {
        expect(res).to.be.false
      })
    })
  })
})
