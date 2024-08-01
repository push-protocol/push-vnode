const axios = require('axios')
var sendMessagePayload = {
  fromCAIP10: 'eip155:0x78475632D71cF77aa957e59E05B3d5dc1e757A5B',
  toCAIP10: 'eip155:0xB182055C3700758759f9435EACed177121F8c248',
  fromDID: 'eip155:0x78475632D71cF77aa957e59E05B3d5dc1e757A5B',
  toDID: 'eip155:0xB182055C3700758759f9435EACed177121F8c248',
  messageContent: 'U2FsdGVkX1/EBvtKJdYdthXckr5Koessx7ddUJQYAQ4=',
  messageType: 'Text',
  signature:
    '-----BEGIN PGP SIGNATURE-----\n\nwsBzBAEBCAAnBQJjocopCRC+Lnp+Q9Xq+hYhBBf48Yg5/cN6f7XQg74uen5D\n1er6AACbkQf9Fr9mBo2M9ORcaN6u7nfnsx5HAWEF7GjbwO71oeMIQqkVlCMQ\nMd5Z8ikQeDoUOd0hkX10Hgm6PfR5dIEh8mNe3aT1V0QHk3/EQnmrTlUoXIyK\nG5up/TsIJEqZ2rH78B/YCNCXZT/BL41LC+Ep9Ui37s3fhXTcds/cE4WXdW22\npJgDo74gWaAKs2XpAOKL4+fXmHHqodpbm8NTq9YeFm8GqCpU6IhhKKo/T19c\n+/5jfxbgP7n6E6eJB+BaK0WZ/k50agRV8BcfzifeBMF3elyNQHaciLtz4Ti1\nzcn6w6iUo75mzo7Lb6uJP0hrpO+hYCaU39JNdfWo3N4uZFnfktSoxw==\n=NxBr\n-----END PGP SIGNATURE-----\n',
  encType: 'pgp',
  encryptedSecret:
    '-----BEGIN PGP MESSAGE-----\n\nwcBMAwB2uBgFYrLIAQf/XH1/rynEiz7hFZEKGfITISWLd9RkgW7nXXd96jwm\nHx6f0Ie2jQpea58siv5IbrQm2BeWMQ7yZAGU+J8Hia2z3iVGcBPTQ4kEMKID\nDDasuMsaP9Kw5WYMU2R6MDUwuxfM9ySAXmjGR2vGG/JmSUtT3djUXrHgTywy\njRSzAgDtR0lm+Xa3URg1H6TdgkV3uWhyVzX9eMjxPJsuQpEs0loBXcG35aIC\nUoqXNJFds9dOvsyvJhqvMTKdihvxbmxwKCu1ZskcXKnoEc0OLOJV/wTZdAyL\nOUd5GG0cK58ACLRHfVxOMLdWMyIG8JjTkhrdJRzfdYa+BtvrsmMnCTn/Qkys\nPcHATAP/9yNUlR0o2gEH+wZd6wvfuSoBNMmqAVFVUAC8kNfSBW9vN2xieOD8\nvB+WzlpRP+JgBJ8QoEVyMteDWBMViCDM2n6BPhY75XR+rEsS3tIf0FIwIYs6\nLR6O+f0DYxakyXI8DL/PjAK9C/4K3JstiRNgtdTNrujTB+DBraWWPf7/1L68\n3NH0GPJCS7QsGRURigcDzhvJq1Wu3UQexUzA1gTwa5F+hw2DX8l7BwhCubhh\n/1ZOS/cmeF+U+Di0TPXtIM7vXakOWI2xd8W66sTMDmB1jANRhRV0wwYfMAAT\n4NCINg2Nru8kJmaqV7tM7cdFs/1atUDU5STMcAq7NYUT+V82Xnv/L/N1B5OQ\nCgHSQAGXSdLYAo1AWEbiMUwymzcNWCg3qaz7xMW23+HeqPfiCGfKJs4IQC+3\nP/P4A6FMLmWuvuyJ/i5vsS2WPor6bvk=\n=rmYm\n-----END PGP MESSAGE-----\n',
  sigType: 'pgp'
}

async function getInbox() {
  try {
    return await axios.get(
      'https://backend-dev.epns.io/apis/v1/chat/users/eip155:0x78475632D71cF77aa957e59E05B3d5dc1e757A5B/messages'
    )
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function resolveIPFS(hash) {
  try {
    return await axios.get('https://backend-dev.epns.io/apis/v1/ipfs/' + hash)
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function sendMessage() {
  try {
    return await axios.post('https://backend-dev.epns.io/apis/v1/chat/message', sendMessagePayload)
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function simulateChat(threadId) {
  try {
    const initialDelay = randomIntFromInterval(1, 3)
    await new Promise((resolve) => setTimeout(resolve, initialDelay * 1000))
    var getInboxResponse = await getInbox()
    console.log('Get inbox :: ' + getInboxResponse.status + ' threadId :: ' + threadId)
    if (getInboxResponse.data.length > 0) {
      var threadhash = getInboxResponse.data[0].threadhash
      for (var i = 1; i <= 10; i++) {
        var resolveIPFSResponse = await resolveIPFS(threadhash)
        console.log(threadhash)
        console.log(
          'resolveIPFSResponse :: ' + resolveIPFSResponse.status + ' threadId :: ' + threadId
        )
        threadhash = resolveIPFSResponse.data.link
        if (threadhash == null) {
          break
        }
      }
    }

    /*const interval = setInterval(function() {
            console.log("Get inbox in loop :: " + getInboxResponse.status + " threadId :: " + threadId);
            getInbox();
        }, 3000);*/

    var total_count = 5
    var count = total_count
    while (count > 0) {
      const delayToSendMessage = randomIntFromInterval(8, 12)
      await new Promise((resolve) => setTimeout(resolve, delayToSendMessage * 1000))
      var sendMessageResponse = await sendMessage()
      console.log(
        'sendMessage :: ' +
          sendMessageResponse.status +
          ' threadId :: ' +
          threadId +
          ' message_count :: ' +
          (total_count - count + 1)
      )
      count = count - 1
    }
    //clearInterval(interval);
    return Promise.resolve({
      success: 0
    })
  } catch (e) {
    console.log(e)
    console.log('error inthread#', threadId)
    return Promise.reject({
      failed: threadId
    })
  }
}

function randomIntFromInterval(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

async function parallelChats() {
  var t1 = new Date().getTime() / 1000
  const promiseArr = []
  const parallelThreads = 900
  for (let i = 0; i < parallelThreads; i++) {
    try {
      promiseArr.push(simulateChat(i))
    } catch (e) {
      console.log(e)
      console.log('failed to submit thread#', i)
    }
  }
  const result = await Promise.allSettled(promiseArr)
  var failed = 0
  var success = 0
  for (let i = 1; i <= parallelThreads; i++) {
    console.log(result[i - 1])
    if (
      'value' in result[i - 1] &&
      'success' in result[i - 1]['value'] &&
      result[i - 1]['value']['success'] == 0
    ) {
      success++
    } else {
      failed++
    }
  }
  var t2 = new Date().getTime() / 1000
  console.log(
    'Execution time :: ' +
      (t2 - t1) +
      ' seconds  ' +
      'Success threads :: ' +
      success +
      ' Failed threads :: ' +
      failed
  )
}

parallelChats()
