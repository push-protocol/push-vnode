import 'mocha'

import chai from 'chai'

import * as chatHelper from '../../src/helpers/chatHelper'

chai.should()
const expect = chai.expect

describe('api/helpers/chatHelper :: chatHelper', function () {
  describe('Gitcoin Subgraph', function () {
    it('Should return true if address has donated to project', async function () {
      const data = await chatHelper.verifyGitcoinDonner(
        '0x46ddc886ac23d5bc2cbc96cd2aa990627bcd98c881a953070f94c15e03267707',
        '0x8c0a58e4399ce264da68c6ed036866a15021273a'
      )
      expect(data.result).to.be.true
    })

    it('Should return false if address has not donated to project', async function () {
      const data = await chatHelper.verifyGitcoinDonner(
        '0x46ddc886ac23d5bc2cbc96cd2aa990627bcd98c881a953070f94c15e03267707',
        '0xD8634C39BBFd4033c0d3289C4515275102423681'
      )
      expect(data.result).to.be.false
    })

    it('Should return false if invalid address passed as input', async function () {
      const data = await chatHelper.verifyGitcoinDonner(
        '0x46ddc886ac23d5bc2cbc96cd2aa990627bcd98c881a953070f94c15e03267707',
        'abcd'
      )
      expect(data.result).to.be.false
    })
  })

  describe('isValidCAIP10Address function', function () {
    it('Should return true if address is in correct format', async function () {
      const partialcaip = 'eip155:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb'
      const res = chatHelper.isValidCAIP10Address(partialcaip)
      expect(res).to.be.true
    })

    it('Should return false if invalid address', async function () {
      // Address below is missing last character
      const partialcaip = 'eip155:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcd'
      const res = chatHelper.isValidCAIP10Address(partialcaip)
      expect(res).to.be.false
    })

    it('Should return false if address not in correct partial CAIP10 format', async function () {
      const partialcaip = 'eip:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcd'
      const res = chatHelper.isValidCAIP10Address(partialcaip)
      expect(res).to.be.false
    })
  })

  describe('caip10ToWallet function', function () {
    // Check if address splitting is correct
    it('Should convert address correctly from eip155', async function () {
      const partialcaip = 'eip155:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb'
      const data = chatHelper.caip10ToWallet(partialcaip)
      const address = partialcaip.split(':')[1]
      expect(data).to.be.equal(address)
    })

    it('Should fail if the address in invalid after convertion', async function () {
      const partialcaip = 'eip155:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcd'
      const data = chatHelper.caip10ToWallet(partialcaip)
      expect(data).to.be.false
    })
  })

  describe('checkNFTOwnership', function () {
    const userAddress = '0x736Cd8461132a1B52d95D535230ca4cd4C8bD7e5'
    const nftAddress = '0x71F19f1b2C689dEF77933b5AA9AB56bf2AE4c0a0'
    const chainId = '11155111'
    const tokenId = '1'
    // Check if NFT owner is valid
    it('Should pass if the address holds an NFT', async function () {
      const res = await chatHelper.checkNFTOwnership(chainId, userAddress, nftAddress, tokenId)
      expect(res).to.be.true
    })

    // NFT token id does not exist
    it('Should fail if the NFT token doesnt exist', async function () {
      const tokenId = 2
      const result = await chatHelper.checkNFTOwnership(chainId, userAddress, nftAddress, tokenId)
      expect(result).to.be.false
    })

    // Provider does not exist for the chain id
    it('Should fail if provider for the chain does not exist', async function () {
      const chainId = '1'
      const res = await chatHelper.checkNFTOwnership(chainId, userAddress, nftAddress, tokenId)
      expect(res).to.be.false
    })

    // NFT is not owned by the address
    it('Should fail if the address does not hold any NFT', async function () {
      const address = '0x118aeFa610ceb7C42C73d83dfC3D8C54124A4946'
      const res = await chatHelper.checkNFTOwnership(chainId, address, nftAddress, tokenId)
      expect(res).to.be.false
    })
  })

  describe('numberOfERC20Tokens tests', function () {
    // Address has PUSH tokens
    it('Should pass if address had PUSH token', async function () {
      const address = 'eip155:0x28a292f4dC182492F7E23CFda4354bff688f6ea8'
      const contractAddress = 'eip155:11155111:0x37c779a1564DCc0e3914aB130e0e787d93e21804'
      const res = await chatHelper.numberOfERC20Tokens(contractAddress, address)
      expect(res.err).to.be.equal(null)
    })

    // Wrong address
    // Note : Need a separate error message for wrong wallet address
    it('Should fail if wallet address is invalid', async function () {
      const address = 'eip155:0x56AeF9d1da974d654D5719E81b365205779161a'
      const contractAddress = 'eip155:11155111:0x2b9bE9259a4F5Ba6344c1b1c07911539642a2D33'
      const res = await chatHelper.numberOfERC20Tokens(contractAddress, address)
      expect(res.err).to.equal(
        'Invalid erc20 address eip155:11155111:0x2b9bE9259a4F5Ba6344c1b1c07911539642a2D33'
      )
    })

    // Invalid Token Address
    it('Should valid if token address is invalid', async function () {
      const address = 'eip155:0x56AeF9d1da974d654D5719E81b365205779161a8'
      const contractAddress = 'eip155:11155111:0x2b9bE9259a4F5Ba6344c1b1c07911539642a2D3'
      const res = await chatHelper.numberOfERC20Tokens(contractAddress, address)
      expect(res.err).to.equal(
        'Invalid erc20 address eip155:11155111:0x2b9bE9259a4F5Ba6344c1b1c07911539642a2D3'
      )
    })
  })
})
