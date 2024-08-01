import 'mocha'

import chai from 'chai'
import chaiHttp from 'chai-http'
import { Container } from 'typedi'

import { startServer, stopServer } from '../../../src/appInit'
import * as Ipfs from '../../../src/helpers/ipfsClient'
import { verifyPayloadIPFSHash } from '../../../src/helpers/utilsHelper'
import channelsPrecacheClass, {
  validateChannelMetaSiganture
} from '../../../src/services/channelsCompositeClasses/precacheChannel'
chai.use(chaiHttp)
chai.should()
const expect = chai.expect
const payload = {
  channel: 'eip155:11155111:0xd8634c39bbfd4033c0d3289c4515275102423681',
  channelMetaVerificationProof:
    'eip712:0x1dcce411a4afee8cfda82a76433a8ca74c5494778a26a1406bd56d9a54609cab7777285342d2e07444208139b50840c0415a1ba1b7ec18b88d85294c2825b4081c',
  channelMeta: {
    name: 'test Channel',
    info: 'testing 123',
    url: 'https://push.org',
    icon: `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABAAEADASIAAhEBAxEB/8QAGQABAQEBAQEAAAAAAAAAAAAAAAMEAgEI/8QAJBAAAgICAQQCAwEAAAAAAAAAAAECAxESBCExQWFRcSIyM4H/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A+VAAAAAAAAAABsVEMdc5M1kdJuJqulro/ZPlx7S/wBHjpxT2fVZIwjtYo57s0xqhqs+fZNQ05EUuwFHRDDSzkyqOZ6v5wanLHIivmJOyOvIi/DaYFHx4duuTLJayafdGuctboe+hHlRxNPwwO+X+kfs9/pxvaRO+2M4pRz3yeUWqCal2YFrXiqEl4aZ7Yszrl7JX2xnFRidVXxUEpZygOeS8Wxa8IratlXJfKM901ZPKXQpVdGMNZZygHL6Sizq/86VJfZG+xWNa9kdV2qNWrTbAgAAAAAAAAAAP/9k=`
  }
}
describe.only('Channel Precache Test', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  describe('Test for  validateChannelMetaSiganture', function () {
    it('Should return true', async () => {
      const res = validateChannelMetaSiganture(payload)
      expect(res).to.be.true
    })
  })

  describe('Test for verifyPayloadIPFSHash', function () {
    it.only('Should return successfully verify for Qm format', async () => {
      const ipfsHash = 'QmVrNtmZDnqu4dLXLB5CCGnNY39LvdHRccBFH8MUQehXR8'
      const ipfsContent = {
        name: 'LI.FI - Test',
        info: 'Cross-chain bridging, swapping and messaging will drive your multi-chain strategy and attract new users from everywhere. - New description',
        url: 'https://push.org/',
        icon: 'data:image/jpeg;base64,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',
        aliasDetails: {}
      }

      const res = await Ipfs.default.uploadToIfuraIpfs(JSON.stringify(ipfsContent))
      expect(res.toLowerCase()).to.be.equal(ipfsHash.toLowerCase())
    })

    it('Should verify successfully for ba format', async () => {
      const ipfsContent = {
        name: 'ClrFund2',
        info: 'A channel that updates the ClrFund community on recent developments',
        url: 'https://clr.fund',
        icon: 'https://res.cloudinary.com/testaccasp/image/upload/v1625771270/imt4uihmiqvf0h4pcegb.png'
      }

      const ipfsHash = 'bafkreiauyl4nqdslsl4fxzbkjpx6hpp6ksm7pgqxsthwxmgnab66teipiy'
      const res = await verifyPayloadIPFSHash(JSON.stringify(payload), ipfsContent, ipfsHash)
      console.log(res)
    })
  })

  describe('Test for stroing valid channel meta to channel+precache table', function () {
    it('Should store the data successfullt in table', async () => {
      try {
        const precahceObj = Container.get(channelsPrecacheClass)
        await precahceObj.addChannelMeta(payload)
        const precahceRes = await precahceObj.getChannelMeta(payload.channel)
        expect(precahceRes).not.null
        // await precahceObj._deleteChannel(payload.channel)
      } catch (error) {
        console.log('error')
        console.log(error)
      }
    })
  })
})
