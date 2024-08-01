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
const channel = '0xA006Fa63fE3C610Fd1a2b6cb5F75D1E9e25c4cC2' //channel to be subscribed / unsubscribed

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
  Subscribe: [
    { name: 'channel', type: 'address' },
    { name: 'subscriber', type: 'address' },
    { name: 'action', type: 'string' }
  ]
}

const Unsubscribertype = {
  Unsubscribe: [
    { name: 'channel', type: 'address' },
    { name: 'unsubscriber', type: 'address' },
    { name: 'action', type: 'string' }
  ]
}

const generateJSON = (action, channel) => {
  if (action == 'Subscribe') {
    return {
      message: {
        channel: channel,
        subscriber: wallet.address,
        action: 'Subscribe'
      }
    }
  } else {
    return {
      message: {
        channel: channel,
        unsubscriber: wallet.address,
        action: 'Unsubscribe'
      }
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
        Subscribe: [
          { name: 'channel', type: 'address' },
          { name: 'subscriber', type: 'address' },
          { name: 'action', type: 'string' }
        ]
      },
      domain: {
        name: 'EPNS COMM V1',
        chainId: chainId,
        verifyingContract: verifyingContract
      },
      primaryType: 'Subscribe',
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
        Unsubscribe: [
          { name: 'channel', type: 'address' },
          { name: 'unsubscriber', type: 'address' },
          { name: 'action', type: 'string' }
        ]
      },
      domain: {
        name: 'EPNS COMM V1',
        chainId: chainId,
        verifyingContract: verifyingContract
      },
      primaryType: 'Unsubscribe',
      message: messageData
    }
  }

  return typedData
}

const outputPostParams = (verificationProof, message, chainId) => {
  let typeOfAddress
  if (message.action == 'Subscribe') typeOfAddress = 'subscriber'
  else typeOfAddress = 'unsubscriber'

  const params = `\t"signature": "${verificationProof}", \t\n"message":{ \n\t"channel": "${
    message.channel
  }",\n\t"${typeOfAddress}": "${
    message.action == 'Subscribe' ? message.subscriber : message.unsubscriber
  }",\n\t"action": "${
    message.action
  }"\n\t }, \n\t"chainId": ${chainId} , \n\t"op":"write" , \n\t"contractAddress":"0x000"`

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

      const recovered = recoverTypedSignature_v4({
        data: getTypedData(message, source),
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
    await outputEIP712V2Signature(subscribeJSON.message, CAIP_TYPE[i], Subscribertype)
    await outputEIP712V2Signature(unsubscribeJSON.message, CAIP_TYPE[i], Unsubscribertype)
  }
}

main()
