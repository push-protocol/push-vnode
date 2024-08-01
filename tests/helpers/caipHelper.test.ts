import * as caiphelper from '../../src/helpers/caipHelper'
import chai from 'chai'
import 'mocha'

chai.should()
const expect = chai.expect

describe('helpers/caipHelper :: caipHelper', function () {
  describe('convertTransactionCaipToObject', function () {
    it('should correctly convert a CAIP with chain ID to an object', () => {
      const address = 'eip155:1:0x1234abcd'
      const expectedOutput = {
        result: {
          chain: 'eip155',
          chainId: '1',
          transactionHash: '0x1234abcd'
        }
      }
      const actualOutput = caiphelper.convertTransactionCaipToObject(address)
      expect(actualOutput).to.deep.equal(expectedOutput)
    })

    it('should correctly convert a CAIP without chain ID to an object', () => {
      const address = 'eip155:0x1234abcd'
      const expectedOutput = {
        result: {
          chain: 'eip155',
          chainId: null,
          transactionHash: '0x1234abcd'
        }
      }
      const actualOutput = caiphelper.convertTransactionCaipToObject(address)
      expect(actualOutput).to.deep.equal(expectedOutput)
    })

    it.skip('should throw an error for an invalid CAIP', () => {
      const address = 'invalid:caip_with_delimiter'
      expect(() => caiphelper.convertTransactionCaipToObject(address)).to.throw(
        'Invalid CAIP Format'
      )
    })

    it('should throw an error for an invalid CAIP', () => {
      const address = 'invalid_caip_without delimiter'
      expect(() => caiphelper.convertTransactionCaipToObject(address)).to.throw(
        'Invalid CAIP Format'
      )
    })
  })

  describe('batchConvertCaipToAddresses', function () {
    it('should correctly convert an array of full caip to an array of addresses', () => {
      const caips = [
        'eip155:1:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        'eip155:1:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        'eip155:1:0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      ]
      const expectedOutput = [
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      ]
      const actualOutput = caiphelper.batchConvertCaipToAddresses(caips)
      expect(actualOutput).to.deep.equal(expectedOutput)
    })

    it('should correctly convert an array of partial caip to an array of addresses', () => {
      const caips = [
        'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      ]
      const expectedOutput = [
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      ]
      const actualOutput = caiphelper.batchConvertCaipToAddresses(caips)
      expect(actualOutput).to.deep.equal(expectedOutput)
    })

    it('should correctly convert an array of CAIPs mix of partial and full caip to an array of addresses', () => {
      const caips = [
        'eip155:1:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        'eip155:1:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      ]
      const expectedOutput = [
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      ]
      const actualOutput = caiphelper.batchConvertCaipToAddresses(caips)
      expect(actualOutput).to.deep.equal(expectedOutput)
    })

    it('should return an empty array if passed an empty array', () => {
      const caips = []
      const expectedOutput = []
      const actualOutput = caiphelper.batchConvertCaipToAddresses(caips)
      expect(actualOutput).to.deep.equal(expectedOutput)
    })

    it('should throw error for mix of valid and invalid caip', () => {
      const caips = [
        'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        'invalid_caip_without_delimiter'
      ]
      const expectedOutput = [
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      ]
      expect(() => caiphelper.batchConvertCaipToAddresses(caips)).to.throw('Invalid CAIP Format')
    })

    it('should throw error for mix of valid and invalid caip', () => {
      const caips = [
        'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        'invalid:caip_with_delimiter'
      ]
      const expectedOutput = [
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      ]
      expect(() => caiphelper.batchConvertCaipToAddresses(caips)).to.throw('Invalid CAIP Format')
    })

    it('should throw an error if any of the CAIPs are invalid', () => {
      const caips = ['eip155:1:0x1234abcd', 'invalid:caip', 'eip155:0x9876def']
      expect(() => caiphelper.batchConvertCaipToAddresses(caips)).to.throw('Invalid CAIP Format')
    })
  })

  describe('isValidCAIP', function () {
    it('should return true for a valid CAIP', () => {
      const caip = 'eip155:1:0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      const isValid = caiphelper.isValidCAIP(caip)
      expect(isValid).to.be.true
    })

    it('should return false for an invalid CAIP', () => {
      const caip = 'eip155:1:invalid'
      const isValid = caiphelper.isValidCAIP(caip)
      expect(isValid).to.be.false
    })

    it('should return false for a non-CAIP address', () => {
      const address = '0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      const isValid = caiphelper.isValidCAIP(address)
      expect(isValid).to.be.false
    })

    it('should return false for a partial CAIP address', () => {
      const address = 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029'
      const isValid = caiphelper.isValidCAIP(address)
      expect(isValid).to.be.false
    })

    it('should return false for a CAIP with invalid address', () => {
      const address = 'eip155:1:invalid_address'
      const isValid = caiphelper.isValidCAIP(address)
      expect(isValid).to.be.false
    })

    it('should return false for a null value', () => {
      const isValid = caiphelper.isValidCAIP(null)
      expect(isValid).to.be.false
    })
  })

  describe('caipConversionByID', function () {
    it('should throw an error if address is invalid', () => {
      const invalidAddress = 'notAnAddress'
      const invalidChainId = 1
      expect(() => caiphelper.caipConversionByID(invalidAddress, invalidChainId)).to.throw(
        'Invalid Address'
      )
    })

    it('should return a valid caip address for ETH_MAINNET', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const chainId = 1
      const expectedCaipAddress = 'eip155:1:0x1234567890abcdef1234567890abcdef12345678'
      expect(caiphelper.caipConversionByID(address, chainId)).to.equal(expectedCaipAddress)
    })

    it('should return a valid caip address for BSC_MAINNET', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const chainId = 97
      const expectedCaipAddress = 'eip155:97:0x1234567890abcdef1234567890abcdef12345678'
      expect(caiphelper.caipConversionByID(address, chainId)).to.equal(expectedCaipAddress)
    })

    it('should throw an error if an invalid chainId is provided', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const invalidChainId = 123
      expect(() => caiphelper.caipConversionByID(address, invalidChainId)).to.throw(
        'Invalid BlockChain Type'
      )
    })
  })

  describe('convertAddressToCaip', function () {
    it('should return the correct CAIP address for a valid Ethereum address', function () {
      const result = caiphelper.convertAddressToCaip(
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        1
      )
      expect(result.result).to.be.equal('eip155:1:0x69e666767Ba3a661369e1e2F572EdE7ADC926029')
      expect(result.err).to.be.null
    })

    it('should return an error for an invalid Ethereum address', function () {
      expect(() => caiphelper.convertAddressToCaip('not-a-valid-address', 1)).to.throw(
        'Invalid Address'
      )
    })

    it('should return the correct CAIP address for a valid address and chain ID', function () {
      const result = caiphelper.convertAddressToCaip(
        '0x69e666767Ba3a661369e1e2F572EdE7ADC926029',
        8001
      )
      expect(result.result).to.be.equal('eip155:8001:0x69e666767Ba3a661369e1e2F572EdE7ADC926029')
      expect(result.err).to.be.null
    })

    it('should throw an error if no address is provided', function () {
      expect(() => caiphelper.convertAddressToCaip()).to.throw()
    })
  })

  describe('convertAddressToPartialCaip', function () {
    it('should return the correct partial CAIP address', function () {
      const input = '0x1234567890123456789012345678901234567890'
      const expectedOutput = 'eip155:0x1234567890123456789012345678901234567890'

      const result = caiphelper.convertAddressToPartialCaip(input)

      expect(result.result).to.equal(expectedOutput)
      expect(result.err).to.be.null
    })

    it('should throw an error for an invalid input', function () {
      const input = 'not_an_address'

      expect(() => caiphelper.convertAddressToPartialCaip(input)).to.throw('Invalid Address')
    })
  })

  describe('isValidPartialCAIP10Address', function () {
    it('should return true for valid partial CAIP-10 address', () => {
      const validAddress = 'eip155:0x0000000000000000000000000000000000000000'
      expect(caiphelper.isValidPartialCAIP10Address(validAddress)).to.be.true
    })

    it('should return false for invalid partial CAIP-10 address', () => {
      const invalidAddress = 'eip155:1:0x00000000000000000000000000000000000000'
      expect(caiphelper.isValidPartialCAIP10Address(invalidAddress)).to.be.false
    })

    it('should return false for non-string input', () => {
      expect(caiphelper.isValidPartialCAIP10Address(123)).to.be.false
    })
  })

  describe('convertTransactionCaipToObject', function () {
    it('should return an object with chain, chainId, and address properties when given a valid full CAIP address', () => {
      const caipAddress = 'eip155:1:0x1234567890123456789012345678901234567890'
      const expectedObject = {
        chain: 'eip155',
        chainId: '1',
        address: '0x1234567890123456789012345678901234567890'
      }
      const result = caiphelper.convertCaipToObject(caipAddress)
      expect(result).to.deep.equal({ result: expectedObject })
    })

    it('should return an object with chain and address properties, but null chainId, when given a valid partial CAIP address', () => {
      const caipAddress = 'eip155:0x1234567890123456789012345678901234567890'
      const expectedObject = {
        chain: 'eip155',
        chainId: null,
        address: '0x1234567890123456789012345678901234567890'
      }
      const result = caiphelper.convertCaipToObject(caipAddress)
      expect(result).to.deep.equal({ result: expectedObject })
    })

    it('should throw an error when given an invalid CAIP address', () => {
      const caipAddress = 'invalid_caip_address'
      expect(() => caiphelper.convertCaipToObject(caipAddress)).to.throw('Invalid CAIP Format')
    })
  })

  describe('convertCaipToAddress', function () {
    it('should return the address if the CAIP format is correct', () => {
      const result = caiphelper.convertCaipToAddress(
        'eip155:1:0x1234567890123456789012345678901234567890'
      )
      expect(result).to.deep.equal({
        result: '0x1234567890123456789012345678901234567890',
        err: null
      })
    })

    it.skip('should return error for invalid chain id', () => {
      expect(() => {
        caiphelper.convertCaipToAddress('eip155:123:0x1234567890123456789012345678901234567890')
      }).to.throw('Invalid CAIP Format')
    })

    it('should throw an error if the CAIP format is invalid', () => {
      expect(() => {
        caiphelper.convertCaipToAddress('invalid-format')
      }).to.throw('Invalid CAIP Format')
    })

    it('should throw an error if the address is invalid', () => {
      expect(() => {
        caiphelper.convertCaipToAddress('eip155:1:invalid-address')
      }).to.throw('Invalid CAIP Format')
    })
  })
})
