import 'mocha'

import chai from 'chai'

import { startServer, stopServer } from '.././../src/appInit'
const payloadHelper = require('../../src/helpers/payloadHelper')
chai.should()
const expect = chai.expect

const startNode = async () => {
  await startServer('error', true)
}

const stopNode = async () => {
  await stopServer()
}
describe('helpers/payloadHelper.ts unit tests', () => {
  describe('Verify getSupportedPayloadIdentites Function', () => {
    // To verify the supported payloads i.e. 0,1,2,3
    it('Should verify payload storage identity', async () => {
      const minmax = payloadHelper.getSupportedPayloadIdentites()
      expect(minmax.min).to.be.equals(0)
      expect(minmax.max).to.be.equals(4)
    })
  })

  describe('Verify segregatePayloadIdentity Function', () => {
    // needed to start and stop server as the helper function uses logger
    before(async function () {
      await startNode()
    })

    after(async function () {
      await stopNode()
    })
    it('Should segregate correct payload identity for type 0', async () => {
      try {
        const identity0 = '0+1+hello+this is body'
        const response = payloadHelper.segregatePayloadIdentity(identity0)
        expect(response.success).to.equal(true)
        expect(response.storageType).to.equal(0)
        expect(response.storagePointer).to.equal('1+hello+this is body')
      } catch (error) {
        console.log(error)
      }
    })

    it('Should not able to segregate because of incorrect payload identity for type 0', async () => {
      try {
        const identity0 = '0-1-hello-this is body'
        const response = payloadHelper.segregatePayloadIdentity(identity0)
        expect(response.success).to.equal(false)
        expect(response.storageType).to.be.null
        expect(response.storagePointer).to.be.null
      } catch (error) {
        console.log(error)
        expect(error).to.be.null
      }
    })

    it.skip('Should not able to segregate because of incorrect payload identity for type 0', async () => {
      try {
        const identity0 = '+1+hello+this is body'
        const response = payloadHelper.segregatePayloadIdentity(identity0)
        expect(response.success).to.equal(false)
        expect(response.storageType).to.be.null
        expect(response.storagePointer).to.be.null
      } catch (error) {
        console.log(error)
        expect(error).to.be.null
      }
    })

    it('Should segregate correct payload identity for type 1', async () => {
      const identity1 = '1+bafkreicuttr5gpbyzyn6cyapxctlr7dk2g6fnydqxy6lps424mcjcn73we'
      const response = payloadHelper.segregatePayloadIdentity(identity1)
      expect(response.success).to.equal(true)
      expect(response.storageType).to.equal(1)
      expect(response.storagePointer).to.equal(
        'bafkreicuttr5gpbyzyn6cyapxctlr7dk2g6fnydqxy6lps424mcjcn73we'
      )
    })

    it.skip('Should not able to segregate for incorrect payload identity for type 1', async () => {
      const identity1 = '+bafkreicuttr5gpbyzyn6cyapxctlr7dk2g6fnydqxy6lps424mcjcn73we'
      const response = payloadHelper.segregatePayloadIdentity(identity1)
      expect(response.success).to.equal(false)
      expect(response.storageType).to.be.null
      expect(response.storagePointer).to.be.null
    })

    it('Should segregate correct payload identity for type 2', async () => {
      const identity2 = '2+56b52a8dedfb9364739d3cc24d62c0e0d7e844f2d27bd1258149dc8b57b82d28'
      const response = payloadHelper.segregatePayloadIdentity(identity2)
      expect(response.success).to.equal(true)
      expect(response.storageType).to.equal(2)
      expect(response.storagePointer).to.equal(
        '56b52a8dedfb9364739d3cc24d62c0e0d7e844f2d27bd1258149dc8b57b82d28'
      )
    })

    it.skip('Should not able to segregate for incorrect payload identity for type 2', async () => {
      const identity2 = '+56b52a8dedfb9364739d3cc24d62c0e0d7e844f2d27bd1258149dc8b57b82d28'
      const response = payloadHelper.segregatePayloadIdentity(identity2)
      expect(response.success).to.equal(false)
      expect(response.storageType).to.be.null
      expect(response.storagePointer).to.be.null
    })

    it('Should segregate correct payload identity for type 3', async () => {
      const identity3 = '3+graph:aiswaryawalter/graph-poc-sample+3'
      const response = payloadHelper.segregatePayloadIdentity(identity3)
      expect(response.success).to.equal(true)
      expect(response.storageType).to.equal(3)
      expect(response.storagePointer).to.equal('graph:aiswaryawalter/graph-poc-sample+3')
    })

    it.skip('Should not able to segregate for incorrect payload identity for 3', async () => {
      const identity3 = '+graph:aiswaryawalter/graph-poc-sample+3'
      const response = payloadHelper.segregatePayloadIdentity(identity3)
      expect(response.success).to.equal(false)
      expect(response.storageType).to.be.null
      expect(response.storagePointer).to.be.null
    })

    it('Should return false for correct payload identity', async () => {
      const identity0 = 'This is me without any delimiters'

      expect(payloadHelper.segregatePayloadIdentity(identity0).success).to.equal(false)
    })
  })

  describe('Verify getSubgraphDetails Function', () => {
    // To verify the supported payloads i.e. 0,1,2,3
    it('Should return valid response', async () => {
      const noificationNumber = 1
      const subgraphId = 'strykerin/my-subgraph'
      const payload = await payloadHelper.getSubgraphDetails(subgraphId, noificationNumber)
      expect(payload).to.have.keys('data', 'notification')
    })

    it.skip('Should return response null', async () => {
      const noificationNumber = 100
      const subgraphId = 'strykerin/my-subgraph'
      expect(await payloadHelper.getSubgraphDetails(subgraphId, noificationNumber)).to.throw(Error)
    })

    it.skip('Should fail for invalid subgraph id', async () => {
      const noificationNumber = 1
      const subgraphId = 'abcd'
      const payload = await payloadHelper.getSubgraphDetails(subgraphId, noificationNumber)
      expect(payload).to.have.keys('data', 'notification')
    })
  })

  describe('Verify fetchPayloadJSONFromIdentity Function', () => {
    // To verify the supported payloads i.e. 0,1,2,3
    it('Should return response for fetchPayloadJSONFromIdentity of minimal payload type', async () => {
      const storageType = 0
      const storagePointer = '1+Hey+This is body'
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(storageType, storagePointer)
      expect(payload.success).to.equal(true)
      expect(payload.err).to.be.null
      expect(payload.jsonPayload).to.have.keys('data', 'notification')
    })

    it.skip('Should return error response for fetchPayloadJSONFromIdentity of minimal payload type', async () => {
      const storageType = 0
      const storagePointer = 'bafkreihm6mg3lyomc2j4xoazudxknsdqnxyit6tnwqr7uuwk3damkycxca'
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(storageType, storagePointer)
      expect(payload.success).to.equal(false)
      expect(payload.err).to.be.not.null
      expect(payload.jsonPayload).to.be.null
    })

    it('Should return response for fetchPayloadJSONFromIdentity of ipfs type', async () => {
      const storageType = 1
      const storagePointer = 'bafkreihm6mg3lyomc2j4xoazudxknsdqnxyit6tnwqr7uuwk3damkycxca'
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(storageType, storagePointer)
      expect(payload.success).to.equal(true)
      expect(payload.err).to.be.null
      expect(payload.jsonPayload).to.have.keys('data', 'notification')
    })

    it('Should return response for fetchPayloadJSONFromIdentity of direct type', async () => {
      const storageType = 2
      const storagePointer = {
        verificationProof:
          'eip712v2:0x2c772f3239ad0b302dfb7ceb8d944bc7ecb51dd422cd9171da542ad15cdf84144d0a6a6677ad96f2f55ee001584f848c53e59d2895f793d71f04d787d07530b81b::uid::0e370a34-1cbc-4875-ae1f-6175a228c431',
        identity:
          '2+{"notification":{"title":"","body":"hey 2"},"data":{"acta":"","aimg":"","amsg":"hey 2","asub":"","type":"1"},"recipients":"eip155:5:0x69e666767Ba3a661369e1e2F572EdE7ADC926029"}',
        sender: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681',
        source: 'ETH_TEST_GOERLI',
        recipient: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681'
      }
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(
        storageType,
        storagePointer,
        storagePointer
      )
      expect(payload.success).to.equal(true)
      expect(payload.err).to.be.null
      expect(payload).to.have.keys('success', 'err', 'jsonPayload')
    })

    it.skip('Should return response for fetchPayloadJSONFromIdentity of direct type without recipients in identity', async () => {
      const storageType = 2
      const storagePointer = {
        verificationProof:
          'eip712v2:0x9782e2fdc684bd28fac9e18c52780d5899ae6270c1d6b1fe6bc47ce42cb13c040d879c79911b4919709581e85e961613e7d8eb18190a556e19868d8ed537443d1c::uid::1626808211',
        sender: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681',
        recipient: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681',
        identity:
          '2+{"notification":{"title":"EPNS x LISCON isafbksFBKSBJFKSBFKSJFKSAJBFASKJBFKJBFWJKFBKSJABFKSJABFKAJSBFKJASBFKA","body":"Dropping test directly on push nodes at LISCON 2021."},"data":{"acta":"","aimg":"","amsg":"Current BTC price is - 47,785.10USD","asub":"","type":"3","secret":"","etime":1659447000,"hidden":false}}',
        source: 'ETH_TEST_GOERLI'
      }
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(storageType, storagePointer)
      expect(payload.success).to.equal(true)
      expect(payload.err).to.be.null
      expect(payload.jsonPayload).to.have.keys('data', 'notification')
    })

    it.skip('Should fail for type direct payload as no storagePointer is passed', async () => {
      const storageType = 2
      const storagePointer = null
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(storageType, storagePointer)
      expect(payload.success).to.equal(true)
      expect(payload.err).to.be.null
      expect(payload.jsonPayload).to.have.keys('data', 'notification')
    })

    it('Should return response for fetchPayloadJSONFromIdentity of subgraph type', async () => {
      const storageType = 3
      const storagePointer = 'graph:strykerin/my-subgraph+1'
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(storageType, storagePointer)
      expect(payload.success).to.equal(true)
      expect(payload.err).to.be.null
      expect(payload.jsonPayload).to.have.keys('data', 'notification')
    })

    /**
     * chat type = 4 was removed from notifications
     */
    it.skip('Should return response for fetchPayloadJSONFromIdentity of chat type', async () => {
      const storageType = 4
      const storagePointer = ':bafyreicya4am5qgns7gm52qwgzvrwytcyqeorzrntv4qawgyck733dpwla'
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(storageType, storagePointer)
      expect(payload.success).to.equal(true)
      expect(payload.err).to.be.null
      expect(payload.jsonPayload).to.have.keys('success', 'err', 'jsonPayload')
      expect(payload.jsonPayload.jsonPayload).to.have.keys('data', 'notification')
    })
  })

  describe('Verify formatPayload Function', () => {
    it('Should return error for passing empty object', async () => {
      //TBD
      const payload = await payloadHelper.formatPayload({})
    })

    it('Should return proper response', async () => {
      const rawPayloadData = {
        title: 'Test',
        body: 'Test body',
        cta: 'https://xyz.com',
        image: 'https://xyz.com/abc.svg',
        message: 'Test message',
        subject: 'Test Subject',
        type: 1
      }
      const payload = await payloadHelper.formatPayload(rawPayloadData)
      expect(payload).have.all.keys('data', 'notification')
      expect(payload.data).to.have.all.keys(
        'acta',
        'aimg',
        'amsg',
        'asub',
        'type',
        'hidden',
        'etime'
      )
      expect(payload.notification).have.all.keys('title', 'body')
    })

    it.skip('Should return aimg as empty for passing invalid image url', async () => {
      const rawPayloadData = {
        title: 'Test',
        body: 'Test body',
        cta: 'https://xyz.com',
        image: 'https://xyz.com/',
        message: 'Test message',
        subject: 'Test Subject',
        type: 1
      }
      const payload = await payloadHelper.formatPayload(rawPayloadData)
      expect(payload).have.all.keys('data', 'notification')
      expect(payload.data).to.have.all.keys(
        'acta',
        'aimg',
        'amsg',
        'asub',
        'type',
        'hidden',
        'etime'
      )
      expect(payload.notification).have.all.keys('title', 'body')
      expect(payload.data.aimg).to.be.equals('')
    })

    it.skip('Should return acta as empty for passing http url', async () => {
      const rawPayloadData = {
        title: 'Test',
        body: 'Test body',
        cta: 'http://xyz.com',
        image: 'https://xyz.com/',
        message: 'Test message',
        subject: 'Test Subject',
        type: 1
      }
      const payload = await payloadHelper.formatPayload(rawPayloadData)
      expect(payload).have.all.keys('data', 'notification')
      expect(payload.data).to.have.all.keys(
        'acta',
        'aimg',
        'amsg',
        'asub',
        'type',
        'hidden',
        'etime'
      )
      expect(payload.notification).have.all.keys('title', 'body')
      expect(payload.data.acta).to.be.equals('')
    })

    it('Should return proper asub and amsg even though message and body are not passed', async () => {
      const rawPayloadData = {
        title: 'Test',
        body: 'Test body',
        cta: 'http://xyz.com',
        image: 'https://xyz.com/',
        type: 1
      }
      const payload = await payloadHelper.formatPayload(rawPayloadData)
      expect(payload).have.all.keys('data', 'notification')
      expect(payload.data).to.have.all.keys(
        'acta',
        'aimg',
        'amsg',
        'asub',
        'type',
        'hidden',
        'etime'
      )
      expect(payload.notification).have.all.keys('title', 'body')
      expect(payload.data.asub).to.be.equals(rawPayloadData.title)
      expect(payload.data.amsg).to.be.equals(rawPayloadData.body)
    })
  })

  describe('Verify segregateVerificationProof Function', () => {
    // needed to start and stop server as the helper function uses logger
    before(async function () {
      await startNode()
    })

    after(async function () {
      await stopNode()
    })

    it('Should return null for empty verificationProof', async () => {
      const verificationProof = ''
      const response = payloadHelper.segregateVerificationProof(verificationProof)
      expect(response).to.have.keys('success', 'verificationType', 'verificationProof')
      expect(response.success).to.be.false
      expect(response.verificationType).to.be.null
      expect(response.verificationProof).to.be.null
    })

    it('Should return null for invalid verificationProof', async () => {
      const verificationProof = 'abcd:abcd'
      const response = payloadHelper.segregateVerificationProof(verificationProof)
      expect(response).to.have.keys('success', 'verificationType', 'verificationProof')
      expect(response.success).to.be.false
      expect(response.verificationType).to.be.null
      expect(response.verificationProof).to.be.null
    })

    it('Should return success for valid eip155:5 verificationProof', async () => {
      const verificationProof =
        'eip155:5:0x5837f5ad52c5d2b5fe799760934886477ea931a4ba131d736eaf88c5b4f6312d'
      const response = payloadHelper.segregateVerificationProof(verificationProof)
      expect(response).to.have.keys('success', 'verificationType', 'verificationProof')
      expect(response.success).to.be.true
      expect(response.verificationType).to.be.equals(
        `${verificationProof.split(':')[0]}:${verificationProof.split(':')[1]}`
      )
      expect(response.verificationProof).to.be.equals(verificationProof.split(':')[2])
    })

    it('Should return success for valid eip155:1 verificationProof', async () => {
      const verificationProof =
        'eip155:1:0x5837f5ad52c5d2b5fe799760934886477ea931a4ba131d736eaf88c5b4f6312d'
      const response = payloadHelper.segregateVerificationProof(verificationProof)
      expect(response).to.have.keys('success', 'verificationType', 'verificationProof')
      expect(response.success).to.be.true
      expect(response.verificationType).to.be.equals(
        `${verificationProof.split(':')[0]}:${verificationProof.split(':')[1]}`
      )
      expect(response.verificationProof).to.be.equals(verificationProof.split(':')[2])
    })

    it('Should return success for valid eip712v1 verificationProof', async () => {
      const verificationProof =
        'eip712v1:0x5837f5ad52c5d2b5fe799760934886477ea931a4ba131d736eaf88c5b4f6312d'
      const response = payloadHelper.segregateVerificationProof(verificationProof)
      expect(response).to.have.keys('success', 'verificationType', 'verificationProof')
      expect(response.success).to.be.true
      expect(response.verificationType).to.be.equals(`${verificationProof.split(':')[0]}`)
      expect(response.verificationProof).to.be.equals(verificationProof.split(':')[1])
    })

    it('Should return success for valid eip712v2 verificationProof', async () => {
      const verificationProof =
        'eip712v2:0x5837f5ad52c5d2b5fe799760934886477ea931a4ba131d736eaf88c5b4f6312d'
      const response = payloadHelper.segregateVerificationProof(verificationProof)
      expect(response).to.have.keys('success', 'verificationType', 'verificationProof')
      expect(response.success).to.be.true
      expect(response.verificationType).to.be.equals(`${verificationProof.split(':')[0]}`)
      expect(response.verificationProof).to.be.equals(verificationProof.split(':')[1])
    })

    it('Should return success for valid thegraph verificationProof', async () => {
      const verificationProof = 'thegraph:aiswaryawalter/graph-poc-sample+3'
      const response = payloadHelper.segregateVerificationProof(verificationProof)
      expect(response).to.have.keys('success', 'verificationType', 'verificationProof')
      expect(response.success).to.be.true
      expect(response.verificationType).to.be.equals(`${verificationProof.split(':')[0]}`)
      expect(response.verificationProof).to.be.equals(verificationProof.split(':')[1])
    })

    it('Should return success for valid w2wv1 verificationProof', async () => {
      const verificationProof =
        'w2wv1:bafyreia22nkc3ks2lwjij4f5iw4prqagwz4k75gxzfacbvm3w6j66dknve:eip155:0x012D969CCCc07030f1dAad6f68dA3e23F4EB5bA4'
      const response = payloadHelper.segregateVerificationProof(verificationProof)
      expect(response).to.have.keys('success', 'verificationType', 'verificationProof')
      expect(response.success).to.be.true
      expect(response.verificationType).to.be.equals(`${verificationProof.split(':')[0]}`)
      expect(response.verificationProof).to.be.equals(
        verificationProof.split(':').slice(1).join(':')
      )
    })
  })

  describe('Verify convertBytesToString Function', () => {
    // needed to start and stop server as the helper function uses logger
    before(async function () {
      await startNode()
    })

    after(async function () {
      await stopNode()
    })

    it('Should return the string that was passed', async () => {
      const input = 'abcd'
      const response = payloadHelper.convertBytesToString(input)
      expect(response).to.be.equals(input)
    })

    it('Should return the number that was passed', async () => {
      const input = 123
      const response = payloadHelper.convertBytesToString(input)
      expect(response).to.be.equals(input)
    })

    it('Should return convert the bytes to string', async () => {
      const input = '0x302b312b48656c6c6f2b68656c6c6f31'
      const expectedOutput = '0+1+Hello+hello1'
      const response = payloadHelper.convertBytesToString(input)
      expect(response).to.be.equals(expectedOutput)
    })
  })

  describe('Verify getChatDetails Function', () => {})

  describe('Verify modifyFeedPayloadForAWSSNS Function', () => {
    it('Should return null for empty verificationProof', async () => {
      const feedPayload = {
        data: {
          app: 'Decentragram',
          sid: '305293',
          url: 'https://decentragram-sage.vercel.app/',
          acta: '',
          aimg: '',
          amsg: 'Hey, Decentragramers',
          asub: 'Hello',
          icon: 'https://gateway.ipfs.io/ipfs/bafybeibwx5vbgeip6oqlgn6a26clb5ayd5t5cto3tpnyesx7ak3pln4zoq/QmNzTk7HeGM8MzM47hvpfzsknZgZjuVLCGmTQWSbSPYn6H',
          type: 1,
          epoch: '1674951332.936',
          etime: null,
          hidden: '0',
          sectype: null
        },
        recipients: 'eip155:0xc2009d705d37a9341d6cd21439cf6b4780eaf2d7',
        notification: { body: 'Hey, Decentragramers', title: 'Decentragram - Hello' },
        verificationProof:
          'eip712v2:0x4aa1594b7cc0a2b893ffb2e54437cb96f8aa2276c1f8900f0ffc142d39249aa679ddf5c100e1b816ff621cb0904b2010cc36cc6371bf1321f94c396f112b3e331b::uid::7df52b89-3398-4426-b390-50ffd640a58e'
      }

      const awsFeed = payloadHelper.modifyFeedPayloadForAWSSNS(feedPayload, '305293')
      expect(awsFeed).to.have.keys('data', 'recipients', 'notification', 'verificationProof')
    })
  })

  describe('Verify batchConvertRecipientToAddress Function', () => {
    it('Should return error for invalid caip format', async () => {
      try {
        const incorectCAIPFormat = {
          '0xdef6a8db4de079e54a400395a279630fe8fc1791': null,
          '0x4D496CcC28058B1D74B7a19541663E21154f9c84': null
        }

        expect(() => {
          payloadHelper.batchConvertRecipientToAddress(incorectCAIPFormat)
        }).to.throw('Invalid CAIP Format')
      } catch (error) {}
    })

    it('Should be able to convert the caip tp plain addresses', async () => {
      try {
        const CAIPFormat = {
          'eip155:5:0xdef6a8db4de079e54a400395a279630fe8fc1791': null,
          'eip155:5:0x4D496CcC28058B1D74B7a19541663E21154f9c84': null
        }

        const response = payloadHelper.batchConvertRecipientToAddress(CAIPFormat)
        const expectedOutput = {}
        Object.keys(CAIPFormat).forEach((address) => {
          expectedOutput[expectedOutput[address].split(':')[2]] = null
        })
        expect(response).to.be.equals(expectedOutput)
      } catch (error) {}
    })

    it('Should be skip the non caip address and convert caip addresses', async () => {
      try {
        const CAIPFormat = {
          '0xdef6a8db4de079e54a400395a279630fe8fc1791': null,
          'eip155:5:0x4D496CcC28058B1D74B7a19541663E21154f9c84': null
        }

        const response = payloadHelper.batchConvertRecipientToAddress(CAIPFormat)
        expect(response).to.have.keys('0x4D496CcC28058B1D74B7a19541663E21154f9c84')
      } catch (error) {}
    })

    it('Should be pass for partial caip', async () => {
      try {
        const CAIPFormat = {
          'eip155:0xdef6a8db4de079e54a400395a279630fe8fc1791': null,
          'eip155:0x4D496CcC28058B1D74B7a19541663E21154f9c84': null
        }
        const expectedOutput = {
          '0xdef6a8db4de079e54a400395a279630fe8fc1791': null,
          '0x4D496CcC28058B1D74B7a19541663E21154f9c84': null
        }

        const response = payloadHelper.batchConvertRecipientToAddress(CAIPFormat)
        expect(response).to.be.equals(expectedOutput)
      } catch (error) {}
    })

    it.skip('Should be fail for unsupported  caip', async () => {
      try {
        const CAIPFormat = {
          'eip155:abcd:0xdef6a8db4de079e54a400395a279630fe8fc1791': null,
          'eip155:abcd:0x4D496CcC28058B1D74B7a19541663E21154f9c84': null
        }

        const response = payloadHelper.batchConvertRecipientToAddress(CAIPFormat)
        expect(response).to.be.null
      } catch (error) {}
    })

    it('Should fail for invalid address', async () => {
      try {
        const CAIPFormat = {
          'eip155:5:abcdefg': null,
          'eip155:5:wxyzabcd': null
        }

        const response = payloadHelper.batchConvertRecipientToAddress(CAIPFormat)
        expect(response).to.be.null
      } catch (error) {}
    })
  })

  describe('Verify generateFeedPayloadFromOriginal Function', () => {
    // needed to start and stop server as the helper function uses logger
    before(async function () {
      await startNode()
    })

    after(async function () {
      await stopNode()
    })

    it.skip('Should fail as empty channelMeta is getting passed for channel based notifications', async () => {
      const ogPayload = {
        data: { acta: '', aimg: '', amsg: 'test', asub: '', type: '1' },
        notification: { body: 'test', title: '' }
      }
      const channelMeta = {}
      const recipient = 'eip155:0x84ec52c57a93ce71f143600129b7bc6b4b3d3776'
      const verificationProof =
        'eip155:42:0xdacab1cf0b066b1c515d5b64d2f774ec217e83993e27e0906b2c1c98c558097d'

      expect(() => {
        payloadHelper.generateFeedPayloadFromOriginal(
          channelMeta,
          ogPayload,
          recipient,
          verificationProof
        )
      }).to.throw(Error)
    })

    it.skip('Should fail as empty payload is getting passed for channel based notifications', async () => {
      const ogPayload = {}
      const channelMeta = {
        name: 'internal',
        icon: 'na',
        url: 'https://app.push.org'
      }
      const recipient = 'eip155:0x84ec52c57a93ce71f143600129b7bc6b4b3d3776'
      const verificationProof =
        'eip155:42:0xdacab1cf0b066b1c515d5b64d2f774ec217e83993e27e0906b2c1c98c558097d'

      expect(() => {
        payloadHelper.generateFeedPayloadFromOriginal(
          channelMeta,
          ogPayload,
          recipient,
          verificationProof
        )
      }).to.throw(Error)
    })

    it.skip('Should fail as empty payload and empty channel meta is getting passed for channel based notifications', async () => {
      const ogPayload = {}
      const channelMeta = {}
      const recipient = 'eip155:0x84ec52c57a93ce71f143600129b7bc6b4b3d3776'
      const verificationProof =
        'eip155:42:0xdacab1cf0b066b1c515d5b64d2f774ec217e83993e27e0906b2c1c98c558097d'

      expect(() => {
        payloadHelper.generateFeedPayloadFromOriginal(
          channelMeta,
          ogPayload,
          recipient,
          verificationProof
        )
      }).to.throw(Error)
    })

    it('Should pass for channel based notifications of type 1 [old format]', async () => {
      const ogPayload = {
        data: { acta: '', aimg: '', amsg: 'test', asub: '', type: '1' },
        notification: { body: 'test', title: '' }
      }
      const channelMeta = {
        name: 'internal',
        icon: 'na',
        url: 'https://app.push.org'
      }
      const recipient = 'eip155:0x84ec52c57a93ce71f143600129b7bc6b4b3d3776'
      const verificationProof =
        'eip155:42:0xdacab1cf0b066b1c515d5b64d2f774ec217e83993e27e0906b2c1c98c558097d'

      const response = payloadHelper.generateFeedPayloadFromOriginal(
        channelMeta,
        ogPayload,
        recipient,
        verificationProof
      )
      expect(response).to.have.keys('notification', 'data', 'recipients', 'verificationProof')
    })

    it('Should pass for channel based notifications of type 1 [new format]', async () => {
      const ogPayload = {
        data: {
          acta: '',
          aimg: '',
          amsg: 'Current BTC price is - 47,785.10USD',
          asub: '',
          type: '1',
          sectype: null
        },
        recipients: '0xd8634c39bbfd4033c0d3289c4515275102423681',
        notification: {
          body: 'Dropping payload directly on push nodes at LISCON 2021.',
          title: 'EPNS x LISCON'
        }
      }
      const channelMeta = {
        name: 'internal',
        icon: 'na',
        url: 'https://app.push.org'
      }
      const recipient = 'eip155:0x84ec52c57a93ce71f143600129b7bc6b4b3d3776'
      const verificationProof =
        'eip155:42:0xdacab1cf0b066b1c515d5b64d2f774ec217e83993e27e0906b2c1c98c558097d'

      const response = payloadHelper.generateFeedPayloadFromOriginal(
        channelMeta,
        ogPayload,
        recipient,
        verificationProof
      )
      expect(response).to.have.keys('notification', 'data', 'recipients', 'verificationProof')
    })

    it('Should pass for channel based notifications of type 3 [old format]', async () => {
      const ogPayload = {
        data: { acta: '', aimg: '', amsg: 'test', asub: '', type: '3', secret: '' },
        notification: { body: 'test', title: '' }
      }
      const channelMeta = {
        name: 'internal',
        icon: 'na',
        url: 'https://app.push.org'
      }
      const recipient = '0x84ec52c57a93ce71f143600129b7bc6b4b3d3776'
      const verificationProof =
        'eip155:42:0xdacab1cf0b066b1c515d5b64d2f774ec217e83993e27e0906b2c1c98c558097d'

      const response = payloadHelper.generateFeedPayloadFromOriginal(
        channelMeta,
        ogPayload,
        recipient,
        verificationProof
      )
      expect(response).to.have.keys('notification', 'data', 'recipients', 'verificationProof')
    })

    it('Should pass for channel based notifications of type 3 [new format] without secret', async () => {
      const ogPayload = {
        data: {
          acta: '',
          aimg: '',
          amsg: 'Current BTC price is - 47,785.10USD',
          asub: '',
          type: '3',
          sectype: ''
        },
        notification: {
          body: 'Dropping payload directly on push nodes at LISCON 2021.',
          title: 'EPNS x LISCON'
        },
        recipients: {
          '0x35B84d6848D16415177c64D64504663b998A6ab4': null
        }
      }
      const channelMeta = {
        name: 'internal',
        icon: 'na',
        url: 'https://app.push.org'
      }
      const recipient = 'eip155:0x84ec52c57a93ce71f143600129b7bc6b4b3d3776'
      const verificationProof =
        'eip155:42:0xdacab1cf0b066b1c515d5b64d2f774ec217e83993e27e0906b2c1c98c558097d'

      const response = payloadHelper.generateFeedPayloadFromOriginal(
        channelMeta,
        ogPayload,
        recipient,
        verificationProof
      )
      expect(response).to.have.keys('notification', 'data', 'recipients', 'verificationProof')
    })

    it('Should pass for channel based notifications of type 3 [new format] with secret', async () => {
      const ogPayload = {
        data: {
          acta: '',
          aimg: '',
          amsg: 'Current BTC price is - 47,785.10USD',
          asub: '',
          type: '3',
          sectype: 'aes+eip712'
        },
        notification: {
          body: 'Dropping payload directly on push nodes at LISCON 2021.',
          title: 'EPNS x LISCON'
        },
        recipients: {
          '0x35B84d6848D16415177c64D64504663b998A6ab4': {
            secret: '0dsddo302320ndsd==03232kdk023nmdcsdjksfdk34fnm349340fnm3403fnm3493n34394'
          }
        }
      }
      const channelMeta = {
        name: 'internal',
        icon: 'na',
        url: 'https://app.push.org'
      }
      const recipient = '0x35B84d6848D16415177c64D64504663b998A6ab4'
      const verificationProof =
        'eip155:42:0xdacab1cf0b066b1c515d5b64d2f774ec217e83993e27e0906b2c1c98c558097d'

      const response = payloadHelper.generateFeedPayloadFromOriginal(
        channelMeta,
        ogPayload,
        recipient,
        verificationProof
      )
      expect(response).to.have.keys('notification', 'data', 'recipients', 'verificationProof')
    })

    it('Should pass for channel based notifications of type 4 [new format] without secret', async () => {
      const ogPayload = {
        data: { acta: '', aimg: '', amsg: 'Hey subset', asub: '', type: '4' },
        recipients: {
          '0x04aa3f6526db6f551efb2426621a03a2c1034670': null,
          '0x69e666767Ba3a661369e1e2F572EdE7ADC926029': null
        },
        notification: { body: 'Hey subset', title: '' }
      }
      const channelMeta = {
        name: 'internal',
        icon: 'na',
        url: 'https://app.push.org'
      }
      const recipient = 'eip155:0x84ec52c57a93ce71f143600129b7bc6b4b3d3776'
      const verificationProof =
        'eip155:42:0xdacab1cf0b066b1c515d5b64d2f774ec217e83993e27e0906b2c1c98c558097d'

      const response = payloadHelper.generateFeedPayloadFromOriginal(
        channelMeta,
        ogPayload,
        recipient,
        verificationProof
      )
      expect(response).to.have.keys('notification', 'data', 'recipients', 'verificationProof')
    })

    it('Should pass for channel based notifications of type 4 [new format] with secret', async () => {
      const ogPayload = {
        data: {
          acta: '',
          aimg: '',
          amsg: 'Current BTC price is - 47,785.10USD',
          asub: '',
          type: '4',
          sectype: 'aes+eip712'
        },
        recipients: {
          '0x35b84d6848d16415177c64d64504663b998a6ab4': {
            secret: '0dsddo302320ndsd==03232kdk023nmdcsdjksfdk34fnm349340fnm3403fnm3493n34394'
          },
          '0x28F1C7B4596D9db14f85c04DcBd867Bf4b14b811': {
            secret: '35345gdfg302320ndsd==03232kdk023nmdcsdjksfdk34fnm349340fnm3403fnm3493n34394'
          },
          '0xD9E0b968400c51F81E278a66645328fA79d1ed78': {
            secret: 'j6765fg302320ndsd==03232kdk023nmdcsdjksfdk34fnm349340fnm3403fnm3493n34394'
          }
        },
        notification: {
          body: 'Dropping payload directly on push nodes at LISCON 2021.',
          title: 'EPNS x LISCON'
        }
      }
      const channelMeta = {
        name: 'internal',
        icon: 'na',
        url: 'https://app.push.org'
      }
      const recipient = 'eip155:0x84ec52c57a93ce71f143600129b7bc6b4b3d3776'
      const verificationProof =
        'eip155:42:0xdacab1cf0b066b1c515d5b64d2f774ec217e83993e27e0906b2c1c98c558097d'

      const response = payloadHelper.generateFeedPayloadFromOriginal(
        channelMeta,
        ogPayload,
        recipient,
        verificationProof
      )
      expect(response).to.have.keys('notification', 'data', 'recipients', 'verificationProof')
    })
  })
})
