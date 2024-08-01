import secrets from '../devtools.secrets.json' assert { type: 'json' }
import config from '../../config/index.ts'
// Main tools
import chalk from 'chalk'
import { ethers } from 'ethers'
import { recoverTypedSignature_v4 } from 'eth-sig-util'

// Variables
const privateKey = secrets.payloadGeneratorPrivKey
const wallet = new ethers.Wallet(privateKey)
const padder = 75
const channel = '0x69e666767ba3a661369e1e2f572ede7adc926029' //channel to be subscribed / unsubscribed

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

const Subscribertype = {
  Data: [{ name: 'data', type: 'string' }]
}

const Unsubscribertype = {
  Data: [{ name: 'data', type: 'string' }]
}

const generateJSON = (action, channel, source="eip155:5") => {
  if (action == 'Subscribe') {
    return {
      message: JSON.stringify(
        {
          channel: `${channel}`,
          subscriber: `${wallet.address}`,
          action: 'Subscribe',
          userSetting: ''
        },
        null,
        4
      )
    }
  } else {
    return {
      message: JSON.stringify(
        {
          channel: channel,
          unsubscriber: wallet.address,
          action: 'Unsubscribe'
        },
        null,
        4
      )
    }
  }
}

const getTypedData = (messageData, source) => {
  const { chainId, verifyingContract } = getDomain(source)

  let typedData
  if (messageData.action == 'Subscribe') {
    typedData = {
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
  } else {
    typedData = {
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
  }

  return typedData
}

const outputPostParams = (verificationProof, message, chainId) => {
  let typeOfAddress
  if (message.action == 'Subscribe') typeOfAddress = 'subscriber'
  else typeOfAddress = 'unsubscriber'

  const params = `\t"signature": "eip712v2:${verificationProof}", \t\n ${JSON.stringify(message)}`

  console.log(chalk.bgWhite.black(`\n   POST PARAMS   `))
  console.log(chalk.gray(`{\n${params}\n}`))
  console.log(chalk.bgWhite.black(`\n   POST PARAMS ENDS  `))
}

const outputEIP712V2Signature = async (message, source, type) => {
  // PRETTY CONSOLES
  console.log(chalk.bgWhite.black(`\n\n${'-'.repeat(padder)}`))
  console.log(chalk.bgWhite.black(`  Action : ${message.action} - Source ${source}`.padEnd(padder)))
  console.log(chalk.bgWhite.black(`${'-'.repeat(padder)}\n`))
  console.log(chalk.gray.dim('Sending from Wallet: '), `${wallet.address}`)
  // PRETTY CONSOLES
  const domain = getDomain(source)
  const { chainId } = getDomain(source)
  await wallet
    ._signTypedData(domain, type, message)
    .then((signature) => {
      console.log(chalk.green.dim(`Signature: ${signature} | Length: ${signature.length}`))
      const data = getTypedData(message, source)
      const recovered = recoverTypedSignature_v4({
        data: data,
        sig: signature
      })
      console.log(chalk.green.dim(`Recovered Account: ${recovered}`))

      outputPostParams(signature, message, chainId)
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
  console.log(chalk.green.bold.inverse('Subscribe / Unsubscribe VERIFICATION PROOF GENERATOR'))
  console.log(chalk.bgBlue.bold.white('GENERATING eip712 PROOFS\n'))

  const subscribeJSON = generateJSON('Subscribe', channel)
  const unsubscribeJSON = generateJSON('Unsubscribe', channel)
  for (let i = 0; i < CAIP_TYPE.length; i++) {
    await outputEIP712V2Signature({data:subscribeJSON.message}, CAIP_TYPE[i], Subscribertype)
    await outputEIP712V2Signature({data:unsubscribeJSON.message}, CAIP_TYPE[i], Unsubscribertype)
  }
}

main()
