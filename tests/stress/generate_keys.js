const openpgp = require('openpgp')
const createCsvWriter = require('csv-writer').createObjectCsvWriter

async function generateKeys() {
  const options = {
    curve: 'curve25519',
    userIDs: [
      {
        name: '',
        email: ''
      }
    ]
  }
  const keys = []

  for (let i = 1; i <= 8000; i++) {
    const key = await openpgp.generateKey(options)
    console.log(i)
    keys.push({
      id: i,
      publicKey: key.publicKey,
      privateKey: key.privateKey
    })
  }

  console.log(keys)
  const csvWriter = createCsvWriter({
    path: 'keys_curve.csv',
    header: [
      { id: 'id', title: 'Id' },
      { id: 'publicKey', title: 'Public Key' },
      { id: 'privateKey', title: 'Private Key' }
    ]
  })

  csvWriter
    .writeRecords(keys) // returns a promise
    .then(() => {
      console.log('Script Done')
    })
  console.log('Keys generated and written to keys.csv')
}

generateKeys()
