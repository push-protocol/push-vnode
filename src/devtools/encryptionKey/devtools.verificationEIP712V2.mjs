import secrets from '../devtools.secrets.json' assert { type: 'json' }
import config from '../../config/index.ts'
import * as keys from './keys.json' assert { type: 'json' }
// Main tools
import chalk from 'chalk'
import { ethers } from 'ethers'
import { recoverTypedSignature_v4 } from 'eth-sig-util'

// Variables
const privateKey = secrets.payloadGeneratorPrivKey
const wallet = new ethers.Wallet(privateKey)
const padder = 75
const PGP_PUBLIC_KEY = keys.default.publicKeyArmored
const ENCRYPTED_PGP_PRIVATE_KEY = keys.default.privateKeyArmored
const ENCRYPTION_TYPE = 'EDCSA'

const CAIP_TYPE = config.default.supportedCAIP

const getDomain = (source) => {
  //return eth domain for graph also
  const MAP_BLOCKCHAIN_TO_ID = config.default.MAP_BLOCKCHAIN_TO_ID
  MAP_BLOCKCHAIN_TO_ID['THE_GRAPH'] = config.default.ethereumChainId

  const chainId = MAP_BLOCKCHAIN_TO_ID[source]
  const verifyingContract = config.default.MAP_ID_TO_COMM_CONTRACT[chainId]
  return {
    name: 'EPNS COMM V1',
    chainId: chainId,
    verifyingContract: verifyingContract
  }
}

const type = {
  Data: [{ name: 'data', type: 'string' }]
}

const generateJSON = () => {
  return {
    data: JSON.stringify({
      encryptedPrivateKey: ENCRYPTED_PGP_PRIVATE_KEY,
      publicKey: PGP_PUBLIC_KEY,
      encryptionType: ENCRYPTION_TYPE
    })
  }
}

const getTypedData = (messageData, source) => {
  const { chainId, verifyingContract } = getDomain(source)

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
    message: messageData
  }
  return typedData
}

const outputPostParams = (verificationProof, chainId) => {
  const params = `
  \t"wallet":"eip155:${chainId}:${wallet.address}",
  \t"publicKey":${JSON.stringify(PGP_PUBLIC_KEY)},
  \t"encryptedPrivateKey":${JSON.stringify(ENCRYPTED_PGP_PRIVATE_KEY)},
  \t"encryptionType":"${ENCRYPTION_TYPE}",
  \t"verificationProof": "${verificationProof}"`

  console.log(chalk.bgWhite.black(`\n   POST PARAMS   `))
  console.log(chalk.gray(`{\n${params}\n}`))
  console.log(chalk.bgWhite.black(`\n   POST PARAMS ENDS  `))
}

const outputEIP712V2Signature = async (message, source) => {
  // PRETTY CONSOLES
  console.log(chalk.bgWhite.black(`\n\n${'-'.repeat(padder)}`))
  console.log(chalk.bgWhite.black(`${'-'.repeat(padder)}\n`))
  console.log(chalk.gray.dim('Sending from Wallet: '), `${wallet.address}`)
  // PRETTY CONSOLES
  const domain = getDomain(source)
  const { chainId } = getDomain(source)

  await wallet
    ._signTypedData(domain, type, message)
    .then((signature) => {
      console.log(chalk.green.dim(`Signature: ${signature} | Length: ${signature.length}`))

      const recovered = recoverTypedSignature_v4({
        data: getTypedData(message, source),
        sig: signature
      })
      console.log(chalk.green.dim(`Recovered Account: ${recovered}`))

      outputPostParams('eip712:' + signature, chainId)
    })
    .catch((err) => {
      console.log(err)
    })

  // PRETTY CONSOLES
  console.log(chalk.bgWhite.black(`\n${'-'.repeat(padder)}`))
  console.log(chalk.bgWhite.black(`${'-'.repeat(padder)}\n`))
  // PRETTY CONSOLES
}

const main = async function () {
  console.log(chalk.green.bold.inverse('Register Encryption Keys VERIFICATION PROOF GENERATOR'))
  console.log(chalk.bgBlue.bold.white('GENERATING eip712 PROOFS\n'))

  const registerJSON = generateJSON()

  for (let i = 0; i < CAIP_TYPE.length; i++) {
    await outputEIP712V2Signature(registerJSON, CAIP_TYPE[i])
  }
}

main()
