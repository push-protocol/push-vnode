import 'mocha'

import chai from 'chai'
chai.should()
const expect = chai.expect

describe.skip('signatureVerificationHelper.ts', function () {
  describe('verifyEIP1271Signature', function () {
    it('Should generate return true', async function () {
      const { result } = await signatureVerificationHelper.verifyEIP1271Signature({
        signer: '0xaC39b311DCEb2A4b2f5d8461c1cdaF756F4F7Ae9',
        message: 'My funds are SAFU with Ambire Wallet',
        signature:
          '0x9863d84f3119ac01d9e3bf9294e6c0c3572a07780fc7c49e8dc913806f4b1dbd4cc075462dc84422a9b981b2556f9c9197d76da7ba3603e53e9300869c574d821c'
      })

      expect(result).to.be.true
    })

    it('Should generate return false', async function () {
      const { result } = await signatureVerificationHelper.verifyEIP1271Signature({
        signer: '0xaC39b311DCEb2A4b2f5d8461c1cdaF756F4F7Ae9',
        message: 'My funds are not SAFU with Ambire Wallet',
        signature:
          '0x9863d84f3119ac01d9e3bf9294e6c0c3572a07780fc7c49e8dc913806f4b1dbd4cc075462dc84422a9b981b2556f9c9197d76da7ba3603e53e9300869c574d821c'
      })

      expect(result).to.be.false
    })
  })
})
