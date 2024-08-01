import * as cryptoHelper from '../../src/helpers/cryptoHelper'
import chai from 'chai'
import 'mocha'
var CryptoJS = require('crypto-js')

chai.should()
const expect = chai.expect

describe('cryptoHelper.ts', function () {
  describe('cryptoHelper function', function () {
    it('Should correctly encrypt and decrypt with AES test', function () {
      const message = 'my test message'
      const key = 'my key'
      const encryptedMessage = cryptoHelper.encryptWithAES(message, key)
      expect(cryptoHelper.decryptWithAES(encryptedMessage, key)).to.be.equals(message)
    })
  })

  describe('verifyHash function', function () {
    it('Should verify hash correctly', function () {
      const message = 'my test message'
      const hash = CryptoJS.SHA256(JSON.stringify(message)).toString(CryptoJS.enc.Hex)
      expect(cryptoHelper.verifyHash(message, hash)).to.be.equals(true)
    })
  })
})
