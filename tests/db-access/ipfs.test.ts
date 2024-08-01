import { expect } from 'chai'
import 'mocha'
import { Message } from '../../src/interfaces/chat'
import {
  createCID,
  uploadMessageToIPFS,
  unpinMessages,
  uploadToIPFS
} from '../../src/db-access/w2w/ipfs'
import * as isIpfs from 'is-ipfs'
import { startServer, stopServer } from '../../src/appInit'

describe('db-access/ipfs.ts unit tests', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  const message: Message = {
    link: 'v2:ce5e0b3dc3ead7643dd62f21d77154442ea05e6d35c7dd1938e1fd7ece0868ea',
    toDID: 'eip155:0x7e796B309772D171e42C3F594B913CD6F2D3474B',
    encType: 'PlainText',
    fromDID: 'eip155:0x4dA3688C85879D2B2c68d466642b1ebfe2c25805',
    sigType: 'pgp',
    toCAIP10: 'eip155:0x7e796B309772D171e42C3F594B913CD6F2D3474B',
    signature:
      '-----BEGIN PGP SIGNATURE-----\n\nwsBzBAEBCAAnBYJkEvleCZBRsvL1ZWMwdRYhBCvf5e8Tyo+smYht91Gy8vVl\nYzB1AADF2Qf6A4cwkFYGHOcWpZ09STeNmgkDJc+X8/2XbkatpHGGCkMNnBbl\nyI4MLjVsDicLYcQQk5O82PGLC+jNBr4dFe7x0NmguzD14bMj0AudIaPI43sW\nKkjRruK5oXpE4HQ3/KaLRRN026MWn7dWY1ffuuGgkulPWPRbyc/CMdfwUdOp\nNsWZc+CIbPrvXPZCsjWd6hNAZHmNgNLEa7su8AuGh6CpFWdhQ6GH58WHPjfz\nOSvXhxtQy49+SCnomueoOcPAzHVn1Gp7DsCtEFx1JwC4QoJfyLlhOavd14mE\noFoFyAtm+zm53IxQ7UBpcEFLvNmsuPw1Jv6Vkek9fkoXfxED9Y3bFA==\n=V6FT\n-----END PGP SIGNATURE-----\n',
    timestamp: 1705305796089,
    fromCAIP10: 'eip155:0x4dA3688C85879D2B2c68d466642b1ebfe2c25805',
    sessionKey: null,
    messageType: 'Text',
    messageContent: 'hello',
    encryptedSecret: '',
    verificationProof:
      'pgp:-----BEGIN PGP SIGNATURE-----\n\nwsBzBAEBCAAnBYJkEvleCZBRsvL1ZWMwdRYhBCvf5e8Tyo+smYht91Gy8vVl\nYzB1AAA8oAf/YylKLttBJnsnZtalYA1sg+ToLpNcwG9w1Y1n8jVHW7BlIg1Q\nNM0RzkQIFN5sdk7J0ZJKs3Rcod+AOWHwmFW2jOw5ciXN/QsxZYUJlAbclC8t\nCypnfCNoWwrB3aAGsimuZ4DMBXKkMBZ84leffWe6qwnVPRbpjPT7NCHt/A1l\nW5hwHKPLnWVg7gWXqrJL/73yuH8knyu0qlJM5TvAof4pAgCcAX4syWvAKdl7\n6AFpLwoF3Rhhu5TFdMpDpNXbzgtIfsz8OH3WS3MnvKFPqBu9TeECwcK7W0Eb\n9PvztPr8MQNxKKQEOPr9BR3p8s7QuJT/9ujm75Vt0dPYGTgAmF7DSw==\n=vsI8\n-----END PGP SIGNATURE-----\n'
  }
  describe('createCID()', function () {
    it('should create a valid CID from a message object', async function () {
      const cid = await createCID(message)
      expect(cid).to.be.a('string')
      expect(isIpfs.cid(cid)).to.be.true
    })
  })

  describe('uploadMessageToIPFS()', function () {
    it('should upload message to IPFS', async function () {
      const cidObject = await uploadMessageToIPFS(message)
      const cid = cidObject.toString()
      const expectedCid = await createCID(message)
      expect(cid).to.equal(expectedCid)
    })
  })

  describe('unpinMessages()', function () {
    it('should unpin message from IPFS', async function () {
      const cidObject = await uploadMessageToIPFS(message)
      await unpinMessages(cidObject)
    })
  })

  describe('uploadToIPFS()', function () {
    it('should upload a file to IPFS', async function () {
      const file = Buffer.from('hello world')
      const { cid } = await uploadToIPFS(file)
      expect(isIpfs.cid(cid.toString())).to.be.true
    })
  })
})
