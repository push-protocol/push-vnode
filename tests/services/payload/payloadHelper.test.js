import payloadHelper from '../../../src/helpers/payloadHelper'
var expect = require('chai').expect

describe.skip('PayloadHelper.ts unit tests', () => {
  describe('Verify getSupportedPayloadIdentites Function', () => {
    // To verify the supported payloads i.e. 0,1,2,3
    it('Should verify payload storage identity', async () => {
      const minmax = payloadHelper.getSupportedPayloadIdentites()
      const difference = minmax.max - minmax.min
      let rand = Math.random()
      rand = Math.floor(rand * difference)
      rand = rand + minmax.min

      const result = payloadHelper.verifyPayloadIdentityStorage(rand)
      expect(result, `Randomized Number - ${rand}`).to.equal(true)
    })

    it('Should catch incorrect payload storage identity', async () => {
      const minmax = payloadHelper.getSupportedPayloadIdentites()
      const difference = minmax.max - minmax.min
      let rand = Math.random()
      rand = Math.floor(rand * difference)
      rand = rand + minmax.max

      const result = payloadHelper.verifyPayloadIdentityStorage(12)

      expect(result, `Randomized Number - ${rand}`).to.equal(false)
    })
  })

  describe('Verify segregatePayloadIdentity Function', () => {
    it('Should segregate correct payload identity for type 0', async () => {
      const identity0 = '0+1+hello+this is body'
      expect(payloadHelper.segregatePayloadIdentity(identity0).success).to.equal(true)
      expect(payloadHelper.segregatePayloadIdentity(identity0).storageType).to.equal(0)
      expect(payloadHelper.segregatePayloadIdentity(identity0).storagePointer).to.equal(
        '1+hello+this is body'
      )
    })

    it('Should segregate correct payload identity for type 1', async () => {
      const identity1 = '1+bafkreicuttr5gpbyzyn6cyapxctlr7dk2g6fnydqxy6lps424mcjcn73we'
      expect(payloadHelper.segregatePayloadIdentity(identity1).success).to.equal(true)
      expect(payloadHelper.segregatePayloadIdentity(identity1).storageType).to.equal(1)
      expect(payloadHelper.segregatePayloadIdentity(identity1).storagePointer).to.equal(
        'bafkreicuttr5gpbyzyn6cyapxctlr7dk2g6fnydqxy6lps424mcjcn73we'
      )
    })

    it('Should segregate correct payload identity for type 2', async () => {
      const identity2 = '2+56b52a8dedfb9364739d3cc24d62c0e0d7e844f2d27bd1258149dc8b57b82d28'
      expect(payloadHelper.segregatePayloadIdentity(identity2).success).to.equal(true)
      expect(payloadHelper.segregatePayloadIdentity(identity2).storageType).to.equal(2)
      expect(payloadHelper.segregatePayloadIdentity(identity2).storagePointer).to.equal(
        '56b52a8dedfb9364739d3cc24d62c0e0d7e844f2d27bd1258149dc8b57b82d28'
      )
    })
    it('Should segregate correct payload identity for type 3', async () => {
      const identity3 = '3+graph:aiswaryawalter/graph-poc-sample+3'
      expect(payloadHelper.segregatePayloadIdentity(identity3).success).to.equal(true)
      expect(payloadHelper.segregatePayloadIdentity(identity3).storageType).to.equal(3)
      expect(payloadHelper.segregatePayloadIdentity(identity3).storagePointer).to.equal(
        'graph:aiswaryawalter/graph-poc-sample+3'
      )
    })

    it('Should return false for correct payload identity', async () => {
      const identity0 = 'This is me without any delimiters'

      expect(payloadHelper.segregatePayloadIdentity(identity0).success).to.equal(false)
    })
  })

  describe('Verify verifyPayloadIdentityHash Function', () => {
    // To verify the supported payloads i.e. 0,1,2,3
    it('Should return true for verify payload hash for type 0', async () => {
      const identity0 = '0+1+hello+this is body'
      const payloadDetails = payloadHelper.segregatePayloadIdentity(identity0)
      const verificationResult = payloadHelper.verifyPayloadIdentityHash(
        payloadDetails.storageType,
        payloadDetails.storagePointer
      )
      expect(verificationResult).to.equal(true)
    })
    it('Should return false for verify payload hash for type 0', async () => {
      const identity0 = '0+1:hello+this is body'
      const payloadDetails = payloadHelper.segregatePayloadIdentity(identity0)
      const verificationResult = payloadHelper.verifyPayloadIdentityHash(
        payloadDetails.storageType,
        payloadDetails.storagePointer
      )
      expect(verificationResult).to.equal(false)
    })
    it('Should return true for verify payload hash for type 1', async () => {
      const identity1 = '1+bafkreicuttr5gpbyzyn6cyapxctlr7dk2g6fnydqxy6lps424mcjcn73we'

      const payloadDetails = payloadHelper.segregatePayloadIdentity(identity1)
      const verificationResult = payloadHelper.verifyPayloadIdentityHash(
        payloadDetails.storageType,
        payloadDetails.storagePointer
      )
      expect(verificationResult).to.equal(true)
    })
    it('Should return false for verify payload hash for type 1', async () => {
      const identity1 = '1+tafkreicuttr5gpbyzyn6cyapxctlr7dk2g6fnydzxyrlpsr24mcjfn73he'

      const payloadDetails = payloadHelper.segregatePayloadIdentity(identity1)
      const verificationResult = payloadHelper.verifyPayloadIdentityHash(
        payloadDetails.storageType,
        payloadDetails.storagePointer
      )
      expect(verificationResult).to.equal(false)
    })
    it('Should return true for verify payload hash for type 2', async () => {
      const identity2 = '2+56b52a8dedfb9364739d3cc24d62c0e0d7e844f2d27bd1258149dc8b57b82d28'
      const payload = {
        notification: {
          title: 'EPNS x LISCON',
          body: 'Dropping payload directly on push nodes at LISCON 2021.'
        },
        data: {
          acta: '',
          aimg: '',
          amsg: 'Current BTC price is - 47,785.10USD',
          asub: '',
          type: '3',
          secret: ''
        }
      }
      const payloadDetails = payloadHelper.segregatePayloadIdentity(identity2)
      const verificationResult = payloadHelper.verifyPayloadIdentityHash(
        payloadDetails.storageType,
        payloadDetails.storagePointer,
        payload
      )
      expect(verificationResult).to.equal(true)
    })
    it('Should return false for verify payload hash for type 2', async () => {
      const identity2 = '2+56b52a8dedfb9364739d3cc24d62c0e0d7e844f2d27bd1258149dc8b57b82d28'
      const payload = {
        notification: {
          title: 'Incorrect Title',
          body: 'Incorrect Body'
        },
        data: {
          acta: '',
          aimg: '',
          amsg: 'Incorrect Message',
          asub: '',
          type: '3',
          secret: ''
        }
      }
      const payloadDetails = payloadHelper.segregatePayloadIdentity(identity2)
      const verificationResult = payloadHelper.verifyPayloadIdentityHash(
        payloadDetails.storageType,
        payloadDetails.storagePointer,
        payload
      )
      expect(verificationResult).to.equal(false)
    })
    it('Should return true for verify payload hash for type 3', async () => {
      const identity3 = '3+graph:aiswaryawalter/graph-poc-sample+3'

      const payloadDetails = payloadHelper.segregatePayloadIdentity(identity3)
      const verificationResult = payloadHelper.verifyPayloadIdentityHash(
        payloadDetails.storageType,
        payloadDetails.storagePointer
      )
      expect(verificationResult).to.equal(true)
    })
    it('Should return false for verify payload hash for type 3', async () => {
      const identity3 = '3:graph:aiswaryawalter/graph-poc-sample:3'
      const payloadDetails = payloadHelper.segregatePayloadIdentity(identity3)
      const verificationResult = payloadHelper.verifyPayloadIdentityHash(
        payloadDetails.storageType,
        payloadDetails.storagePointer
      )
      expect(verificationResult).to.equal(false)
    })
  })

  describe('Verify verifyTransactionHash Function', () => {
    // To verify the supported payloads i.e. 0,1,2,3
    it('Should return true for verify payload transaction hash', async () => {
      const transactionHash = '0x54566ad7928db6f78e69d7e18c7760ff92d2f2a32c749485242f8cc4a8db3c87'
      const channel = '0xd8634c39bbfd4033c0d3289c4515275102423681'
      const identity =
        '0x312b6261666b726569637574747235677062797a796e36637961707863746c7237646b326736666e7964717879366c70733432346d636a636e37337765'
      const blockchain = 'ETH_TEST_KOVAN'
      const verificationResult = await payloadHelper.verifyTransactionHash(
        transactionHash,
        channel,
        identity,
        blockchain
      )
      expect(verificationResult).to.equal(true)
    }).timeout(10000)

    it('Should return false for verify payload transaction hash', async () => {
      const transactionHash = '0x54566ad7928db6f78e69d7e18c7760ff92d2f2a32c749485242f8cc4a8db3c87'
      const channel = '0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      const identity =
        '0x312b6261666b726569637574747235677062797a796e36637961707863746c7237646b326736666e7964717879366c70733432346d636a636e37337765'
      const blockchain = 'ETH_TEST_KOVAN'
      const verificationResult = await payloadHelper.verifyTransactionHash(
        transactionHash,
        channel,
        identity,
        blockchain
      )
      expect(verificationResult).to.equal(false)
    }).timeout(10000)
  })

  describe('Verify getSubgraphDetails Function', () => {
    // To verify the supported payloads i.e. 0,1,2,3
    it('Should return response for getSubgraphDetails', async () => {
      const noificationNumber = 3
      const subgraphId = 'aiswaryawalter/graph-poc-sample'
      const payload = await payloadHelper.getSubgraphDetails(subgraphId, noificationNumber)
      expect(payload).to.have.keys('data', 'notification')
    })
  })

  describe('Verify fetchPayloadJSONFromIdentity Function', () => {
    // To verify the supported payloads i.e. 0,1,2,3
    it('Should return response for fetchPayloadJSONFromIdentity of smart contract type', async () => {
      const storageType = 0
      const storagePointer = '1+Hey+This is body'
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(storageType, storagePointer)
      expect(payload.success).to.equal(true)
      expect(payload.err).to.be.null
      expect(payload.jsonPayload).to.have.keys('data', 'notification')
    })
    it('Should return response for fetchPayloadJSONFromIdentity of ipfs type', async () => {
      const storageType = 1
      const storagePointer = 'bafkreihm6mg3lyomc2j4xoazudxknsdqnxyit6tnwqr7uuwk3damkycxca'
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(storageType, storagePointer)
      expect(payload.success).to.equal(true)
      expect(payload.err).to.be.null
      expect(payload.jsonPayload).to.have.keys('data', 'notification')
    })
    it('Should return response for fetchPayloadJSONFromIdentity of subgraph type', async () => {
      const storageType = 3
      const storagePointer = 'graph:aiswaryawalter/graph-poc-sample+3'
      const payload = await payloadHelper.fetchPayloadJSONFromIdentity(storageType, storagePointer)
      expect(payload.success).to.equal(true)
      expect(payload.err).to.be.null
      expect(payload.jsonPayload).to.have.keys('data', 'notification')
    })
  })

  describe('Verify verifyPayloadSenderProof Function', () => {
    // To verify the supported payloads i.e. 0,1,2,3
    it('Should return response for verifyPayloadSenderProof of smart contract type', async () => {
      const channel = '0xd8634c39bbfd4033c0d3289c4515275102423681'
      const trxHash = '0x54566ad7928db6f78e69d7e18c7760ff92d2f2a32c749485242f8cc4a8db3c87'
      const recipient = '0xd8634c39bbfd4033c0d3289c4515275102423681'
      const blockchain = 'ETH_TEST_KOVAN'
      const identityBytes =
        '0x312b6261666b726569637574747235677062797a796e36637961707863746c7237646b326736666e7964717879366c70733432346d636a636e37337765'
      const verificationStaus = await payloadHelper.verifyPayloadSenderProof(
        trxHash,
        channel,
        recipient,
        blockchain,
        identityBytes
      )
      expect(verificationStaus).to.equal(true)
    }).timeout(5000)

    // it('Should return response for verifyPayloadSenderProof of subgraph type', async () => {
    //     const channel = '0xd8634c39bbfd4033c0d3289c4515275102423681'
    //     const trxHash = '3+graph:aiswaryawalter/graph-poc-sample+3'
    //     const recipient = '0xd8634c39bbfd4033c0d3289c4515275102423681'
    //     const blockchain = 'THE_GRAPH'
    //     const identityBytes =
    //         '0x332b67726170683a616973776172796177616c7465722f67726170682d706f632d73616d706c652b33'
    //     const verificationStaus = await payloadHelper.verifyPayloadSenderProof(
    //         trxHash,
    //         channel,
    //         recipient,
    //         blockchain,
    //         identityBytes
    //     )
    //     expect(verificationStaus).to.equal(true)
    // }).timeout(5000)
  })
})
