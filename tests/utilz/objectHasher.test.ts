// noinspection SpellCheckingInspection
import { ObjectHasher } from '../../src/utilz/objectHasher'
import 'mocha'
import { assert } from 'chai'

describe('testObjectHasher1', function () {
  it('testChange1Field', async function () {
    const obj = <FeedItem>{
      header: {
        verification:
          'eip712v2:0x37ba76d10dceff2c4675d186a17b0e0ffe6020eef42ba170a2436192051996ad3daf835bb660bbad587f44a4e153bd9285fe0a166b35abd978453942f0b325ec1c::uid::1675756031',
        sender: 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681',
        recipients: ['eip155:0xd8634c39bbfd4033c0d3289c4515275102423681'],
        senderType: 0,
        source: 'ETH_TEST_GOERLI'
      },
      payload: {
        notification: {
          title: 'testing goerli - EPNS x LISCON',
          body: 'Dropping test directly on push nodes at LISCON 2021.'
        },
        data: {
          type: 3,
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
          sid: '1a5ada93-99dd-4ed3-b325-666627787c73'
        },
        recipients: {
          'eip155:0xd8634c39bbfd4033c0d3289c4515275102423681': null
        },
        verificationProof:
          'eip712v2:0x37ba76d10dceff2c4675d186a17b0e0ffe6020eef42ba170a2436192051996ad3daf835bb660bbad587f44a4e153bd9285fe0a166b35abd978453942f0b325ec1c::uid::1675756031'
      }
    }
    const hashStr1 = ObjectHasher.hashToSha256(obj)
    obj.header.sender += '1'
    const hashStr2 = ObjectHasher.hashToSha256(obj)
    console.log(hashStr1)
    console.log(hashStr2)
  })

  it('testHashingOrder', async function () {
    {
      const obj1 = {
        notification: {
          title: 't',
          body: 'b',
          values: [1, 2]
        }
      }
      const obj2 = {
        notification: {
          body: 'b',
          title: 't',
          values: [1, 2]
        }
      }
      const hashStr1 = ObjectHasher.hashToSha256(obj1)
      const hashStr2 = ObjectHasher.hashToSha256(obj2)
      assert.strictEqual(hashStr1, hashStr2)
    }
    {
      const obj1 = {
        notification: {
          body: 'b',
          title: 't',
          values: [1, 2]
        }
      }
      const obj2 = {
        notification: {
          body: 'b',
          title: 't',
          values: [2, 1]
        }
      }
      const hashStr1 = ObjectHasher.hashToSha256(obj1)
      const hashStr2 = ObjectHasher.hashToSha256(obj2)
      console.log(hashStr1)
      assert.notStrictEqual(hashStr1, hashStr2)
    }
    {
      const obj1 = {
        notification: {
          body: 'b',
          title: 't',
          nested: {
            a: 1,
            b: 2
          }
        }
      }
      const obj2 = {
        notification: {
          body: 'b',
          title: 't',
          nested: {
            b: 2,
            a: 1
          }
        }
      }
      const hashStr1 = ObjectHasher.hashToSha256(obj1)
      const hashStr2 = ObjectHasher.hashToSha256(obj2)
      assert.strictEqual(hashStr1, hashStr2)
    }
  })
  it('testNoClassInfoNoMethodInfo', async function () {
    {
      const obj1 = {
        title: 't',
        body: 'b'
      }

      const obj2 = new FNotification()
      obj2.title = 't'
      obj2.body = 'b'

      const hashStr1 = ObjectHasher.hashToSha256(obj1)
      const hashStr2 = ObjectHasher.hashToSha256(obj2)
      assert.strictEqual(hashStr1, hashStr2)

      const obj3 = {
        notification: {
          title: 't',
          body: 'b'
        }
      }
      const hashStr3 = ObjectHasher.hashToSha256(obj3)
      assert.notStrictEqual(hashStr1, hashStr3)
    }
  })
})

async function signCheck1() {}

class FeedItem {
  header: FHeader
  payload: FPayload
}

class FHeader {
  verification: string // ex: eip712v2:0xFO00::uid::3F
  sender: string // ex: eip155:1:0x6500
  recipients: string[] // ex: eip155:1:0x0700 or a list of recipients
  senderType: number // ex: #SenderType.CHANNEL
  source: string // ex: ETH_MAINNET
  // subscribed:boolean;    //,         ex: true
  // isSpam:boolean;        //,             ex: true
}

class FPayload {
  data: FData
  notification: FNotification
  sectype: string
  recipients: any
  verificationProof: any
}

class FData {
  app: string
  sid: string
  url: string
  acta: string
  aimg: string
  amsg: string
  asub: string
  icon: string
  type: number
  epoch: string
  etime: string
  sectype: string
  hidden: string // 0 or 1
  videoMeta: any
}

class FNotification {
  title: string
  body: string

  someMethod(a: string): string {
    return null
  }
}
