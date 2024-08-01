// Main tools
import chalk from 'chalk'
import { recoverTypedSignature_v4 } from 'eth-sig-util'
import { ethers } from 'ethers'

import config from '../../config/index.ts'
import secrets from '../devtools.secrets.json' assert { type: 'json' }
import * as keys from './keys.json' assert { type: 'json' }

// Variables
const privateKey = secrets.payloadGeneratorPrivKey
const wallet = new ethers.Wallet(privateKey)
const padder = 75
const CAIP_TYPE = config.default.supportedCAIP

const getDomain = (source) => {
  //return eth domain for graph also
  const MAP_BLOCKCHAIN_TO_ID = config.default.MAP_BLOCKCHAIN_TO_ID
  MAP_BLOCKCHAIN_TO_ID['THE_GRAPH'] = config.default.ethereumChainId

  const chainId = MAP_BLOCKCHAIN_TO_ID[source]
  const verifyingContract = config.default.MAP_ID_TO_COMM_CONTRACT[chainId]
  console.log({
    name: 'EPNS COMM V1',
    chainId: chainId,
    verifyingContract: verifyingContract
  })
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
        name: "test Channel",
        info: "testing 123",
        url: "https://push.org",
        icon: `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABAAEADASIAAhEBAxEB/8QAGQABAQEBAQEAAAAAAAAAAAAAAAMEAgEI/8QAJBAAAgICAQQCAwEAAAAAAAAAAAECAxESBCExQWFRcSIyM4H/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A+VAAAAAAAAAABsVEMdc5M1kdJuJqulro/ZPlx7S/wBHjpxT2fVZIwjtYo57s0xqhqs+fZNQ05EUuwFHRDDSzkyqOZ6v5wanLHIivmJOyOvIi/DaYFHx4duuTLJayafdGuctboe+hHlRxNPwwO+X+kfs9/pxvaRO+2M4pRz3yeUWqCal2YFrXiqEl4aZ7Yszrl7JX2xnFRidVXxUEpZygOeS8Wxa8IratlXJfKM901ZPKXQpVdGMNZZygHL6Sizq/86VJfZG+xWNa9kdV2qNWrTbAgAAAAAAAAAAP/9k=`
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
