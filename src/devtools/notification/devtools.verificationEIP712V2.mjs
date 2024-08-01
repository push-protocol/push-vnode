import secrets from '../devtools.secrets.json' assert { type: 'json' }
import config from '../../config/index.ts'
// Main tools
import chalk from 'chalk'
import { recoverTypedSignature_v4 } from 'eth-sig-util'
import { ethers } from 'ethers'

// Variables
const privateKey = secrets.payloadGeneratorPrivKey
const wallet = new ethers.Wallet(privateKey)
const padder = 75

const CAIP_TYPE = config.default.supportedCAIP
const RECIPIENT = "0x69e666767Ba3a661369e1e2F572EdE7ADC926029"
const getDomain = (source) => {
  //return eth domain for graph also
  const MAP_BLOCKCHAIN_TO_ID = config.default.MAP_BLOCKCHAIN_TO_ID
  MAP_BLOCKCHAIN_TO_ID['THE_GRAPH'] = config.default.ethereumChainId
  MAP_BLOCKCHAIN_TO_ID['SIMULATE'] = config.default.ethereumChainId
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

const generatePayloadJSON = () => {
  // DEFINE PAYLOAD TWEAKS HERE
  let payloadJSON = {
    data: {
      acta: "",
      aimg: "",
      amsg: "testing range type",
      asub: "testing range type",
      type: "1",
      index: "3-3-5"
    },
    recipients: {
      [RECIPIENT]: null,
    },
    notification: {
      body: "testing range type",
      title: "testing range type"
    }
  }
  return payloadJSON
}

const getTypedData = (messageData, source) => {
  const { chainId, verifyingContract } = getDomain(source)
  console.log(verifyingContract)
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

const outputPostParams = (verificationProof, channel, recipient, identity, source) => {
  let caipPrefix = source

  let MAP_BLOCKCHAIN_CAIP_TO_STRING = {}
  Object.entries(config.default.MAP_BLOCKCHAIN_STRING_TO_CAIP).map(
    ([key, value]) => (MAP_BLOCKCHAIN_CAIP_TO_STRING[value] = key)
  )

  MAP_BLOCKCHAIN_CAIP_TO_STRING['THE_GRAPH'] = 'THE_GRAPH'
  MAP_BLOCKCHAIN_CAIP_TO_STRING['SIMULATE'] = 'SIMULATE'
  if (source == config.default.graphId || source == config.default.simulateId) caipPrefix = `eip155:${config.default.ethereumChainId}`
  const params = `\t"verificationProof": "eip712v2:${verificationProof}::uid::${Math.floor(
    new Date().getTime() / 1000
  )}",\n\t"sender": "${caipPrefix}:${channel}",\n\t"recipient": "eip155:${RECIPIENT}",\n\t"identity": "${identity.replace(
    /\"/g,
    '\\"'
  )}",\n\t"source": "${MAP_BLOCKCHAIN_CAIP_TO_STRING[source]}"`

  console.log(chalk.bgWhite.black(`\n   POST PARAMS   `))
  console.log(chalk.gray(`{\n${params}\n}`))
  console.log(chalk.bgWhite.black(`\n   POST PARAMS ENDS  `))
}

const outputEIP712V2Signature = async (identityType, message, payloadJSON, source) => {
  // PRETTY CONSOLES
  console.log(chalk.bgWhite.black(`\n\n${'-'.repeat(padder)}`))
  console.log(
    chalk.bgWhite.black(
      `  Generating Identity ${identityType} EIP712 Proof for ${source}`.padEnd(padder)
    )
  )
  console.log(chalk.bgWhite.black(`${'-'.repeat(padder)}\n`))
  console.log(chalk.gray.dim('Sending from Wallet: '), `${wallet.address}`)
  // PRETTY CONSOLES
  const domain = getDomain(source)
  await wallet._signTypedData(domain, type, message).then((signature) => {
    console.log(chalk.green.dim(`Signature: ${signature} | Length: ${signature.length}`))

    const recovered = recoverTypedSignature_v4({
      data: getTypedData(message.data, source),
      sig: signature
    })
    console.log(chalk.green.dim(`Recovered Account: ${recovered}`))
    outputPostParams(signature, wallet.address, wallet.address, message.data, source)
  })

  // PRETTY CONSOLES
  console.log(chalk.bgWhite.black(`\n${'-'.repeat(padder)}`))
  console.log(chalk.bgWhite.black(`  Finished for ${identityType} - ${source}`.padEnd(padder)))
  console.log(chalk.bgWhite.black(`${'-'.repeat(padder)}\n`))
  // PRETTY CONSOLES
}

const generateIdentityType0 = async (payloadJSON, source) => {
  const identityType = 0
  const message = {
    data: `${identityType}+${payloadJSON.data.type}+${payloadJSON.notification.title}+${payloadJSON.notification.body}`
  }

  await outputEIP712V2Signature(identityType, message, payloadJSON, source)
}

const generateIdentityType1 = async (payloadJSON, source) => {
  const identityType = 1
  const ipfsHash = 'bafkreicuttr5gpbyzyn6cyapxctlr7dk2g6fnydqxy6lps424mcjcn73we'
  const message = {
    data: `${identityType}+${ipfsHash}`
  }

  await outputEIP712V2Signature(identityType, message, payloadJSON, source)
}

const generateIdentityType2 = async (payloadJSON, source) => {
  // payloadJSON = JSON.stringify(payloadJSON).replace(/\"/g,'\\"');
  const identityType = 2
  const stringifiedData = JSON.stringify(payloadJSON)
  const data = `${identityType}+${stringifiedData}`
  const message = {
    data: data
  }
  await outputEIP712V2Signature(identityType, message, payloadJSON, source)
}

const generateIdentityType3 = async (graphPayload, source) => {
  const identityType = 3
  const message = {
    data: `${identityType}+${graphPayload}`
  }

  await outputEIP712V2Signature(identityType, message, graphPayload, source)
}

// It all starts here
const main = async function () {
  console.log(chalk.green.bold.inverse('PAYLOADS / VERIFICATION PROOF GENERATOR'))
  console.log(chalk.bgBlue.bold.white('GENERATING eip712v2 PROOFS\n'))

  const payloadJSON = generatePayloadJSON()
  console.log(chalk.green.dim(`Payload JSON: ${JSON.stringify(payloadJSON, null, 4)}`))

  const graphPayload = 'graph:aiswaryawalter/graph-poc-sample+3'
  console.log(chalk.green.dim(`Graph Payload: ${JSON.stringify(graphPayload, null, 4)}`))

  for (let i = 0; i < CAIP_TYPE.length; i++) {
    await generateIdentityType0(payloadJSON, CAIP_TYPE[i])
    await generateIdentityType1(payloadJSON, CAIP_TYPE[i])
    await generateIdentityType2(payloadJSON, CAIP_TYPE[i])
  }
  // exception for graph and simulate
  await generateIdentityType3(graphPayload, 'THE_GRAPH')
  await generateIdentityType2(payloadJSON, 'SIMULATE')
}

main()
