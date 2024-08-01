import secrets from '../devtools.secrets.json' assert { type: 'json' }
import config from '../../config'
// Main tools
import chalk from 'chalk'
import { recoverTypedSignature_v4 } from 'eth-sig-util'
import { ethers } from 'ethers'

const RPC_URL = config.default.web3BerachainProvider
const CONTRACT_ADDRESS = config.default.deployedCommunicatorContractBerachain
const CONTRACT_ABI = config.default.deployedCommunicatorContractABI
// Variables
const privateKey = secrets.payloadGeneratorPrivKey
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const wallet = new ethers.Wallet(privateKey, provider)
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
const signer = contract.connect(wallet)
const executeAddDelegate = async () => {
  const trxPromise = signer.addDelegate('0x69e666767Ba3a661369e1e2F572EdE7ADC926029')
  await trxPromise
    .then(async function (tx) {
      console.info('Transaction sent: %o', tx)
      await tx.wait(3)
      resolve(tx)
    })
    .catch((err) => {
      console.error(err)
    })
}

executeAddDelegate()
