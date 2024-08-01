import { Coll } from '../../../src/utilz/coll'
import { MessageBlockUtil } from '../../../src/services/messaging-common/messageBlock'

const block1: MessageBlock = {
  requests: [
    {
      senderType: 0,
      id: '833e9bb3-52b5-4ad4-8dfd-3f7971d0658d',
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
          { addr: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681', ts: 1692321012 }
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
          sid: '833e9bb3-52b5-4ad4-8dfd-3f7971d0658d'
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
          tsMillis: 1692718627263
        },
        signature:
          '0x8b27c42bc26768571dc437b92aaa2105b0d81bec0ec1155396e557425da20d254f263d6e71ceb8791f21384886670b5ec4f9c7e24c3ac20f628d4a394a6571f31c'
      },
      {
        data: {
          recipientsMissing: { recipients: [], sid: '833e9bb3-52b5-4ad4-8dfd-3f7971d0658d' }
        },
        nodeMeta: {
          nodeId: '0xfDAEaf7afCFbb4e4d16DC66bD2039fd6004CFce8',
          role: 'A',
          tsMillis: 1692718629661
        },
        signature:
          '0x47073510a0bf61f5335ef5693217c7b6fdebcb1fb43dd7b9eda20c95eafc7e4955da43d5198aee50ab6eb53eb064ff6f437b91a578dc255aaeddfd20075232971b'
      }
    ]
  ],
  attestToken:
    'eyJub2RlcyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE2OTI3MTg2MjAwMzIsInJhbmRvbUhleCI6IjE1NjgwMzRiNjg4NzgwM2Y2OWM1MDcyYmIzMGU4ZGY2OWU2ZjE2ZDEiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE2OTI3MTg1OTAwNTAsInN0YXR1cyI6MX1dLCJzaWduYXR1cmUiOiIweDdkZTI5NzUyNzQzNDgxMWE4NWE3NzMyNDgyYTFhM2I2ODlhODY4MDBjZGI5NTY3MGI1OWU4N2JmMGY5Mzg2NDE0ZTk1Y2M4MmM1NWZmMDcwNGI3YmEwZjA0YTgwMjgzMDY4YWVkZGViNWM5NGIxMGY4ZTdjMDViMzI0ZGM0MzI5MWMifSx7Im5vZGVJZCI6IjB4OGUxMmRFMTJDMzVlQUJmMzViNTZiMDRFNTNDNEU0NjhlNDY3MjdFOCIsInRzTWlsbGlzIjoxNjkyNzE4NjIwMDUwLCJyYW5kb21IZXgiOiJlMDUzZTIzYjExZDA2OTZiNGMwY2MxMGM2MGNlNDYzOWFkZTM5ODk1IiwicGluZ1Jlc3VsdHMiOlt7Im5vZGVJZCI6IjB4ZkRBRWFmN2FmQ0ZiYjRlNGQxNkRDNjZiRDIwMzlmZDYwMDRDRmNlOCIsInRzTWlsbGlzIjoxNjkyNzE4NjIwMDMwLCJzdGF0dXMiOjF9XSwic2lnbmF0dXJlIjoiMHg2M2EzYjkzYjNmNTRmOTAyYjk2NDI0YTAxODU5Y2EyN2ZjNjA1YzNmNmVmNmQ2NDNiMTM5YTdlYzI2OGM0YjkyMmNlYzFhYWMwODM5M2FjM2MxMmNiMDI1MTNjZTliN2NkNTkzNDQ5ZTY2MDlkN2JmMmUyMmQ1MzI4ZjJiNTllZjFjIn1dfQ=='
}

function testBlock1() {
  const checkResult = MessageBlockUtil.checkBlock(
    block1,
    Coll.arrayToSet([
      '0x8e12dE12C35eABf35b56b04E53C4E468e46727E8',
      '0xfDAEaf7afCFbb4e4d16DC66bD2039fd6004CFce8'
    ])
  )
  console.log(`valid=${checkResult}`)
  console.log()
}

describe('test_MessageBlock', function () {
  it('test1Payload', testBlock1)
})
