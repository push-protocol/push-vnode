const axios = require('axios')
const MESSAGE_COUNT = 20
const BASE_URL = 'https://backend-dev.epns.io/apis/v1/'

async function benchMarkFILE(hash, threadId) {
  count = 1
  while (count <= MESSAGE_COUNT) {
    try {
      const response = await axios.get(BASE_URL + 'ipfs/file/' + hash)

      hash = response.data.link
      count++
    } catch (error) {
      return Promise.reject({
        failed: threadId
      })
    }
  }
  return Promise.resolve({
    success: 0
  })
}

async function benchMarkMYSQL(threadId) {
  try {
    const response = await axios.get(
      BASE_URL + 'ipfs/mysql/' + 'eip155:0x78475632D71cF77aa957e59E05B3d5dc1e757A5B'
    )
  } catch (error) {
    return Promise.reject({
      failed: threadId
    })
  }
  return Promise.resolve({
    success: 0
  })
}

async function benchMarkIPFS(hash, threadId) {
  count = 1
  while (count <= MESSAGE_COUNT) {
    try {
      const response = await axios.get(BASE_URL + 'ipfs/' + hash)
      hash = response.data.link
      count++
    } catch (error) {
      return Promise.reject({
        failed: threadId
      })
    }
  }
  return Promise.resolve({
    success: 0
  })
}

var hash = 'bafyreibzo3w5roodb5ilj4jf42zcjfbljlgqzx2wgnd3dm5bkuknxlapii'
var file = 'f9d2469e-ebba-46ff-bdb2-33f22f480b2e'

async function run(parallelThreads) {
  var t1 = new Date().getTime() / 1000
  const promiseArr = []
  for (let i = 0; i < parallelThreads; i++) {
    try {
      promiseArr.push(benchMarkMYSQL())
    } catch (e) {
      console.log(e)
      console.log('failed to submit thread#', i)
    }
  }
  const result = await Promise.allSettled(promiseArr)
  var failed = 0
  var success = 0
  for (let i = 1; i <= parallelThreads; i++) {
    if (result[i - 1]['status'] == 'fulfilled') {
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

//benchMarkIPFS(hash)
//benchMarkFILE(file)
//benchMarkMYSQL()

async function final() {
  var parallelThreads = [10, 10, 20, 40, 60, 100, 200, 400, 500, 800]
  for (let i = 0; i < parallelThreads.length; i++) {
    await run(parallelThreads[i])
  }
}
final()
