import secrets from '../devtools.secrets.json' assert { type: 'json' }
import * as keys from './keys.json' assert { type: 'json' }
console.log(keys)
import config from '../../config/index.ts'
// Main tools
import chalk from 'chalk'
import { recoverTypedSignature_v4 } from 'eth-sig-util'
import { ethers } from 'ethers'
import * as CryptoJS from 'crypto-js'

// Variables
const privateKey = secrets.payloadGeneratorPrivKey
const wallet = new ethers.Wallet(privateKey)
const padder = 75

const getDomain = (source) => {
      return {
        name: 'EPNS COMM V1',
        chainId: config.default.ethereumChainId,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      };
}

const getChainIdAndVerifyingContract = (source) => {
  return {
    chainId: config.default.ethereumChainId,
    verifyingContract: "0x0000000000000000000000000000000000000000"
  }
}

const type = {
  Data: [{ name: 'data', type: 'string' }]
}

const generatePayloadJSON = () => {
  // DEFINE PAYLOAD TWEAKS HERE
  const payloadJSON = {
    caip10: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
    did: 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681',
    publicKey: keys.default.publicKeyArmored,
    encryptedPrivateKey: keys.default.privateKeyArmored,
    encryptionType: 'ecda',
    name:'',
    encryptedPassword:null,
    nftOwner:null,
  }

  return payloadJSON
}

const getTypedData = (messageData, source) => {
  const { chainId, verifyingContract } = getChainIdAndVerifyingContract(source)
  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      Data: [{ name: 'data', type: 'string' }]
    },
    domain: {
      name: 'EPNS COMM V1',
      chainId: chainId,
      verifyingContract: verifyingContract
    },
    primaryType: 'Data',
    message: { data: messageData }
  }

  return typedData
}

const outputPostParams = (verificationProof, channel, recipient, identity, payload) => {
  let caipPrefix
  // if (source == config.default.graphId || source == config.default.ethereumId)
  caipPrefix = `eip155:${config.default.ethereumChainId}:`
  // if (source == config.default.polygonId) caipPrefix = `eip155:${config.default.polygonChainId}:`;
  const params = `\t"signature": "${verificationProof}",\n\t"hashedContent": "${identity}",\n\t${JSON.stringify(
    payload
  )}`

  console.log(chalk.bgWhite.black(`\n   POST PARAMS   `))
  console.log(chalk.gray(`{\n${params}\n}`))
  console.log(chalk.bgWhite.black(`\n   POST PARAMS ENDS  `))
}

const outputEIP712V2Signature = async (message, payloadJSON, source) => {
  // PRETTY CONSOLES
  console.log(chalk.bgWhite.black(`\n\n${'-'.repeat(padder)}`))
  console.log(chalk.bgWhite.black(`${'-'.repeat(padder)}\n`))
  console.log(chalk.gray.dim('Sending from Wallet: '), `${wallet.address}`)
  // PRETTY CONSOLES
  const domain = getDomain(source)
  console.log(message)
  await wallet._signTypedData(domain, type, message).then((signature) => {
    console.log(chalk.green.dim(`Signature: ${signature} | Length: ${signature.length}`))

    const recovered = recoverTypedSignature_v4({
      data: getTypedData(message.data, source),
      sig: signature
    })
    console.log(chalk.green.dim(`Recovered Account: ${recovered}`))

    outputPostParams(signature, wallet.address, wallet.address, message.data, payloadJSON)
  })

  // PRETTY CONSOLES
  console.log(chalk.bgWhite.black(`\n${'-'.repeat(padder)}`))
  //   console.log(chalk.bgWhite.black(`  Finished for ${identityType} - ${source}`.padEnd(padder)));
  console.log(chalk.bgWhite.black(`${'-'.repeat(padder)}\n`))
  // PRETTY CONSOLES
}

const generateIdentityType2 = async (payloadJSON, hashedContent, source) => {
  // payloadJSON = JSON.stringify(payloadJSON).replace(/\"/g,'\\"');
  const stringifiedData = hashedContent
  const data = stringifiedData
  const message = {
    data: data
  }
  await outputEIP712V2Signature(message, payloadJSON, source)
}

// It all starts here
const main = async function () {
  console.log(chalk.green.bold.inverse('PAYLOADS / VERIFICATION PROOF GENERATOR'))
  console.log(chalk.bgBlue.bold.white('GENERATING eip712v2 PROOFS\n'))
  console.log(generatePayloadJSON())
  const hashedPayloadJSON = CryptoJS.default
    .SHA256(JSON.stringify(generatePayloadJSON()))
    .toString(CryptoJS.default.enc.Hex)

  console.log(chalk.green.dim(`Payload JSON: ${JSON.stringify(hashedPayloadJSON, null, 4)}`))

  const SOURCE_TYPE = config.default.supportedSourceTypes

  await generateIdentityType2(generatePayloadJSON(), hashedPayloadJSON, SOURCE_TYPE[0])
}

main()
