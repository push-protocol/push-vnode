import 'mocha'
import { assert } from 'chai'
import { ValidatorClient } from '../../../src/services/messaging/validatorClient'
import StrUtil from '../../../src/utilz/strUtil'
import { AddPayloadRequest } from '../../../src/services/messaging/msgConverterService'
import { MessageBlock, NetworkRole } from '../../../src/services/messaging-common/messageBlock'

// vars are defined at the top level for clean formatting

const payload1 = <AddPayloadRequest>{
  id: '3ace91dc-2915-4823-8b41-f6f28fe0d24e',
  verificationProof:
    'eip712v2:0x37ba76d10dceff2c4675d186a17b0e0ffe6020eef42ba170a2436192051996ad3daf835bb660bbad587f44a4e153bd9285fe0a166b35abd978453942f0b325ec1c::uid::1675756031',
  sender: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681',
  recipient: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681',
  identity: '0+3+EPNS x LISCON+Dropping test directly on push nodes at LISCON 2021.',
  source: 'ETH_TEST_GOERLI'
}

const block1: MessageBlock = {
  requests: [
    {
      senderType: 0,
      id: '603c20f2-edbf-4616-8400-c540e69c2bc1',
      verificationProof:
        'eip712v2:0x37ba76d10dceff2c4675d186a17b0e0ffe6020eef42ba170a2436192051996ad3daf835bb660bbad587f44a4e153bd9285fe0a166b35abd978453942f0b325ec1c::uid::1675756031',
      sender: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681',
      recipient: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
      source: 'ETH_TEST_GOERLI',
      identityBytes: '0+1+EPNS x LISCON+Dropping test directly on push nodes at LISCON 2021.',
      validatorToken:
        'eyJub2RlcyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE2OTIyNzk1MTAwNTEsInJhbmRvbUhleCI6IjA5ZWFmOWE0YmE4ZDA3OTNkOTZjZmQ2OGYzNmE5ZDAwMDMzY2FlNGUiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE2OTIyNzk1MTAwMjgsInN0YXR1cyI6MX1dLCJzaWduYXR1cmUiOiIweDAwYmYwMjNiYWExMTI0ZTEzYzI2MDg5ZWY1MjVmNWE2YjhmZGY4OWJhODA1YzRjNjU3OTJiMmY2M2I2ZmI3MDY1MWNlYjM1YTEzODM2MjZhODdmYzU4OGExNjQ1NDViMDE0NDk5NWFkM2Q5ODRlMGM2MDcwOWZmZWM1MDcxNThjMWMifSx7Im5vZGVJZCI6IjB4ZkRBRWFmN2FmQ0ZiYjRlNGQxNkRDNjZiRDIwMzlmZDYwMDRDRmNlOCIsInRzTWlsbGlzIjoxNjkyMjc5NTEwMDU1LCJyYW5kb21IZXgiOiIxN2RlZTc1NDcwYjQ0NWFiNDgzN2U4YTdhNDIxNmIwMjhkMzA4MTMyIiwicGluZ1Jlc3VsdHMiOlt7Im5vZGVJZCI6IjB4OGUxMmRFMTJDMzVlQUJmMzViNTZiMDRFNTNDNEU0NjhlNDY3MjdFOCIsInRzTWlsbGlzIjoxNjkyMjc5NTEwMDM3LCJzdGF0dXMiOjF9XSwic2lnbmF0dXJlIjoiMHgzYjJhOTVkMTBlNDdkZjY2MGRmMzM2NzcxNTA2MWZlOWE3ZDZhYTUzZGZmMGE2NzI2YzI0MjI0OWU2NDUyNTFiNjQ4MWQwMWNiMmViMWJiMDRkMmI1ZjI3ZjA1ODFkZTc5ZTFiNjdjMzRiZTBkNTMyOWE1YWViZWZiMGJjYjE0YTFiIn1dfQ=='
    }
  ],
  responses: [
    {
      header: {
        sender: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681',
        recipientsResolved: [
          {
            addr: 'eip155:0x5ac9E6205eACA2bBbA6eF716FD9AabD76326EEee',
            ts: 1664871012
          },
          {
            addr: 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
            ts: 1666268868
          },
          {
            addr: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
            ts: 1692321012
          }
        ],
        senderType: 0,
        source: 'ETH_TEST_GOERLI'
      },
      payload: {
        notification: {
          title: 'testing goerli - EPNS x LISCON',
          body: 'Dropping test directly on push nodes at LISCON 2021.'
        },
        data: {
          type: 1,
          app: 'testing goerli',
          icon: 'https://gateway.ipfs.io/ipfs/bafybeidkt3qrlcplntabfazs7nnzlxdzu36mmieth2ocyphm2kp4sh333a/QmTX8zZjzuKpiLZmn4ShNzyKDakNdbBQfwi449TBw7wgoK',
          url: 'https://dev.push.org/',
          sectype: null,
          asub: 'EPNS x LISCON',
          amsg: 'Dropping test directly on push nodes at LISCON 2021.',
          acta: '',
          aimg: '',
          etime: null,
          hidden: '0',
          silent: '0',
          additionalMeta: null,
          sid: '603c20f2-edbf-4616-8400-c540e69c2bc1'
        },
        recipients: 'eip155:0xd8634c39bbfd4033c0d3289c4515275102423681',
        verificationProof:
          'eip712v2:0x37ba76d10dceff2c4675d186a17b0e0ffe6020eef42ba170a2436192051996ad3daf835bb660bbad587f44a4e153bd9285fe0a166b35abd978453942f0b325ec1c::uid::1675756031'
      }
    }
  ],
  responsesSignatures: [
    [
      {
        data: null,
        nodeMeta: {
          nodeId: '0x8e12dE12C35eABf35b56b04E53C4E468e46727E8',
          role: 'V',
          tsMillis: 1692704794550
        },
        signature:
          '0x810200d70b1a28f4a795b64265f92a29b78b2a0dba9c216a512746d87442d73d7425cbc501e282c40fdcdc5c46d5704a70da068cedc395d2d34e35ff5fccf0691b'
      },
      {
        data: {
          recipientsMissing: {
            recipients: [],
            sid: '603c20f2-edbf-4616-8400-c540e69c2bc1'
          }
        },
        nodeMeta: {
          nodeId: '0xfDAEaf7afCFbb4e4d16DC66bD2039fd6004CFce8',
          role: 'A',
          tsMillis: 1692704794632
        },
        signature:
          '0xfd8d6b424cf95ab9b3ffb47cb310a60a9dc3b2a26994ea67b090435d7a9124bb597f3ffd9766e84b727a4c5c1c59dfc2cd5a38822e2587baa56dfda3203fd9a81b'
      }
    ]
  ],
  id: '94970aa6-8566-4655-ab3a-2f7846bc8520',
  attestToken:
    'eyJub2RlcyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE2OTI3MDQ3OTAwMzgsInJhbmRvbUhleCI6ImY1YmUxZTg0NDcyZGY2OTQ0MzdiZDBiYjNiZTk2M2Y1ZjJkYWVkYzUiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE2OTI3MDQ3OTAwMzYsInN0YXR1cyI6MX1dLCJzaWduYXR1cmUiOiIweGMxMGU3NDVlZThmOWMxYmY5YmNmOGJjOGIzYjE2NzNmNDA5Yjc3ODdkNWU2YzkyODE4NmY0ZDE5ODZhOTAwYjgyM2MwODAwZjg2YzYyNzZkNDhjOWY2MjRiNzBjYzBkMmFhYjNmZDVhZTEwMjFhN2MzMWU0MTQ4ZDBmZDg4ZTc5MWMifSx7Im5vZGVJZCI6IjB4OGUxMmRFMTJDMzVlQUJmMzViNTZiMDRFNTNDNEU0NjhlNDY3MjdFOCIsInRzTWlsbGlzIjoxNjkyNzA0NzkwMDUyLCJyYW5kb21IZXgiOiI1ZjM2ZTI3ZDMwNGJhZmIyMzk5NmZlMzlhZjM4MzVjZGE2YzU5MjgxIiwicGluZ1Jlc3VsdHMiOlt7Im5vZGVJZCI6IjB4ZkRBRWFmN2FmQ0ZiYjRlNGQxNkRDNjZiRDIwMzlmZDYwMDRDRmNlOCIsInRzTWlsbGlzIjoxNjkyNzA0NzkwMDMwLCJzdGF0dXMiOjF9XSwic2lnbmF0dXJlIjoiMHhhOGZhM2FiODBiZWIyYjYzYjNlZmM4OTQxYTc5NzBmY2U3M2ZlZjk0ZTIxYjIxM2Y3YTViMTAyZDk4ZDc5M2Y2MzY4MjVjNGU2ZGZkMDJmMjEzZmJkNWEyNzM4MGI5MDgxZDU2M2MyNWNmZmEzNDllZmQ3NDY2NzA5ZTI1MjczYzFiIn1dfQ=='
}

// requires a running node at localhost:4000

async function test1Payload() {
  try {
    const client = new ValidatorClient('http://localhost:4000/apis/v1')

    const success = await client.addMessageAsync(payload1)
    assert.isTrue(success, 'addMessage failed')
    const mb = await client.batchProcessBlock()
    assert.isNotNull(mb)
    console.log('finished', StrUtil.toStringDeep(mb))
    console.log(
      StrUtil.toStringDeep(mb.responses[0]) + '\n\n' + StrUtil.toStringDeep(block1.responses[0])
    )
    assert.deepStrictEqual(mb.responses[0], block1.responses[0])
    assert.strictEqual(mb.requests.length, 1)
    assert.strictEqual(mb.responses.length, 1)
    assert.strictEqual(mb.responsesSignatures.length, 1)
    const feedItemSigns = mb.responsesSignatures[0]
    assert.strictEqual(feedItemSigns.length, 2)
    assert.strictEqual(feedItemSigns[0].nodeMeta.nodeId, feedItemSigns[1].nodeMeta.nodeId)
    assert.strictEqual(feedItemSigns[0].nodeMeta.role, NetworkRole.VALIDATOR)
    assert.strictEqual(feedItemSigns[1].nodeMeta.role, NetworkRole.ATTESTER)
    console.log('finished test')
  } catch (e) {
    console.log(e)
    throw e
  }
}

const payload2 = <AddPayloadRequest>{
  id: '23948712047120837412973',
  verificationProof:
    'eip712v2:0x37ba76d10dceff2c4675d186a17b0e0ffe6020eef42ba170a2436192051996ad3daf835bb660bbad587f44a4e153bd9285fe0a166b35abd978453942f0b325ec1c::uid::1675756031',
  sender: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681',
  recipient: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681',
  identity: '0+3+EPNS x LISCON+Dropping test directly on push nodes at LISCON 2021.',
  source: 'ETH_TEST_GOERLI'
}

async function test2Payloads() {
  try {
    const client = new ValidatorClient('http://localhost:4000/apis/v1')

    let success = await client.addMessageAsync(payload1)
    assert.isTrue(success, 'addMessage failed')
    success = await client.addMessageAsync(payload2)
    assert.isTrue(success, 'addMessage2 failed')
    const mb = await client.batchProcessBlock()
    assert.isNotNull(mb)
    console.log('finished', StrUtil.toStringDeep(mb))
    assert.strictEqual(mb.requests.length, 2)
    assert.strictEqual(mb.responses.length, 2)
    assert.strictEqual(mb.responsesSignatures.length, 2)
    {
      const feedItemSigns = mb.responsesSignatures[0]
      assert.strictEqual(feedItemSigns.length, 2)
      assert.strictEqual(feedItemSigns[0].nodeMeta.nodeId, feedItemSigns[1].nodeMeta.nodeId)
      assert.strictEqual(feedItemSigns[0].nodeMeta.role, NetworkRole.VALIDATOR)
      assert.strictEqual(feedItemSigns[1].nodeMeta.role, NetworkRole.ATTESTER)
    }
    {
      const feedItemSigns = mb.responsesSignatures[1]
      assert.strictEqual(feedItemSigns.length, 2)
      assert.strictEqual(feedItemSigns[0].nodeMeta.nodeId, feedItemSigns[1].nodeMeta.nodeId)
      assert.strictEqual(feedItemSigns[0].nodeMeta.role, NetworkRole.VALIDATOR)
      assert.strictEqual(feedItemSigns[1].nodeMeta.role, NetworkRole.ATTESTER)
    }
    console.log('finished test')
  } catch (e) {
    console.log(e)
    throw e
  }
}

async function test1PayloadBlocking() {
  try {
    const client = new ValidatorClient('http://localhost:4000/apis/v1')

    const batchJobSucceded = new Promise<void>((resolve, reject) => {
      setTimeout(async () => {
        try {
          console.log('calling batch job')
          const mb = await client.batchProcessBlock()
          assert.isNotNull(mb)
          console.log('finished', StrUtil.toStringDeep(mb))
          resolve()
        } catch (e) {
          reject(e)
        }
      }, 2000)
    })

    const addMessageBlockingSucceded = new Promise<void>(async (resolve, reject) => {
      try {
        // a long blocking call which waits for batch job
        const success = await client.addMessageBlocking(payload1)
        assert.isTrue(success, 'addMessage failed')
        resolve()
      } catch (e) {
        reject()
      }
    })
    console.log('waiting for all to complete')
    await Promise.all([batchJobSucceded, addMessageBlockingSucceded])
    console.log('finished test')
  } catch (e) {
    console.log(e)
    throw e
  }
}

describe('test_ProcessAndValidateBy1Node', function () {
  it('test1Payload', test1Payload)
  it('test2Payloads', test2Payloads)
  it('test1PayloadBlocking', test1PayloadBlocking).timeout(10000)
})
