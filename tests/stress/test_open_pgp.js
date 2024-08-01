const openpgp = require('openpgp')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const createCsvReader = require('csv-reader')
const fs = require('fs')

async function test(numKeys, keys) {
  console.log('Number of keys :: ' + numKeys)

  const publicKeys = []

  for (let i = 0; i < numKeys; i++) {
    publicKeys.push(keys[i])
  }

  const pgpKeys = []
  for (let i = 0; i < publicKeys.length; i++) {
    pgpKeys.push(
      await openpgp.readKey({
        armoredKey: publicKeys[i]
      })
    )
  }
  const message = 'Hello, World!'

  const m = await openpgp.createMessage({
    text: message
  })

  var t1 = new Date().getTime()

  /*const encrypted = await openpgp.encrypt({
        message: m,
        encryptionKeys: pgpKeys
    })*/

  const encrypted = await openpgp.encrypt({
    message: m,
    passwords: publicKeys, // multiple passwords possible
    config: { preferredCompressionAlgorithm: openpgp.enums.compression.zlib } // compress the data with zlib
  })

  //console.log(encrypted)
  var t2 = new Date().getTime()

  console.log('Encrypted message length :: ' + encrypted.length)
  console.log('Execution time :: ' + (t2 - t1))

  var returnValue = {
    numOfKeys: numKeys,
    executionTime: t2 - t1,
    encryptedMessageLength: encrypted.length
  }

  return returnValue
}

// user curve
// different pgp keys
// check compressing feature
async function run() {
  var keys = await readPublicKeys()

  console.log(keys.length)

  var result = []

  for (let i = 1; i <= 9; i++) {
    const publicKeys = await test(i, keys)
    result.push(publicKeys)
  }

  for (let i = 10; i <= 100; i = i + 5) {
    const publicKeys = await test(i, keys)
    result.push(publicKeys)
  }

  for (let i = 1000; i <= 8000; i = i + 1000) {
    const publicKeys = await test(i, keys)
    result.push(publicKeys)
  }

  const csvWriter = createCsvWriter({
    path: './output.csv',
    header: [
      {
        id: 'numOfKeys',
        title: 'No of keys'
      },
      {
        id: 'executionTime',
        title: 'Execution time (ms)'
      },
      {
        id: 'encryptedMessageLength',
        title: 'Encrypted message length'
      }
    ]
  })
  csvWriter
    .writeRecords(result) // returns a promise
    .then(() => {
      console.log('Script Done')
    })

  console.log(result)
}

async function readPublicKeys() {
  const publicKeys = []
  let headerSkipped = false
  const inputStream = fs.createReadStream('keys_rsa.csv', 'utf8')
  const csvReader = createCsvReader({
    parseNumbers: true,
    parseBooleans: true,
    trim: true
  })

  csvReader.on('data', (data) => {
    if (!headerSkipped) {
      headerSkipped = true
      return
    }
    publicKeys.push(data[1])
  })

  csvReader.on('end', () => {
    console.log(`Public keys read from keys.csv:`)
  })

  await new Promise((resolve) => {
    inputStream.pipe(csvReader).on('end', resolve)
  })
  return publicKeys
}

run()
