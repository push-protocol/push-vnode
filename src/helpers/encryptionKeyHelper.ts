import { Common, Hardfork } from '@ethereumjs/common'
import { TransactionFactory } from '@ethereumjs/tx'
import axios from 'axios'
import { recoverTypedSignature_v4 as recoverTypedSignatureV4 } from 'eth-sig-util'

import config from '../config'
import { SignatureVerification } from '../interfaces/notification'
import * as epnsAPIHelper from './epnsAPIHelper'

export const verifyEncryptionKeyVerificationProof = (
  wallet: string,
  verificationProof: string,
  encryptedPrivateKey: string,
  publicKey: string,
  encryptionType: string,
  chainId: number
): SignatureVerification => {
  try {
    const address = wallet.split(':')[1]
    const message = {
      data: JSON.stringify({
        encryptedPrivateKey: encryptedPrivateKey,
        publicKey: publicKey,
        encryptionType: encryptionType
      })
    }

    const contractAddress = config.MAP_ID_TO_COMM_CONTRACT[chainId]
    let signature: string
    if (verificationProof.split(':').length === 2 && verificationProof.split(':')[0] === 'eip712') {
      signature = verificationProof.split(':')[1]
    }

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
        verifyingContract: contractAddress
      },
      primaryType: 'Data',
      message: message
    }

    const recoveredAddress = recoverTypedSignatureV4({
      data: typedData,
      sig: signature
    })

    if (recoveredAddress.toLowerCase() == address.toLowerCase())
      return { success: true, verified: true, error: null }
    else
      return {
        success: true,
        verified: false,
        error: `${recoveredAddress} is the not the rightful signer`
      }
  } catch (error) {
    return { success: false, verified: false, error: error }
  }
}

const pubKeyHelper = async (provider: any, txHash: string, address: string) => {
  const tx = await provider.getTransaction(txHash)
  const common = new Common({ chain: config.ethereumChainId, hardfork: Hardfork.London })
  const txData = {
    nonce: tx.nonce ? BigInt(tx.nonce) : null,
    gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : null,
    gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : null,
    to: tx.to,
    value: tx.value ? BigInt(tx.value) : null,
    data: tx.data,
    v: tx.v ? BigInt(tx.v) : tx.v,
    r: tx.r ? BigInt(tx.r) : tx.r,
    s: tx.s ? BigInt(tx.s) : tx.s,
    type: tx.type ? BigInt(tx.type) : null,
    chainId: tx.chainId ? tx.chainId : null,
    accessList: tx.accessList,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : null,
    maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : null
  }

  const processedTx = TransactionFactory.fromTxData(txData, { common })
  const publicKey = '0x04' + processedTx.getSenderPublicKey().toString('hex')
  const senderAddress = processedTx.getSenderAddress().toString()
  if (senderAddress.toLowerCase() === address.toLowerCase()) {
    return {
      success: true,
      keys: {
        publicKey: publicKey,
        encryptedPrivateKey: null,
        encryptionType: 'EDCSA',
        verificationProof: 'eip155:' + txHash
      }
    }
  } else {
    return { success: false, keys: null }
  }
}

export const publicKeyFetcher = async (
  wallet: string
): Promise<{ success: boolean; keys: {} | null }> => {
  try {
    const network = config.web3EthereumNetwork
    const contractAddress = config.deployedCommunicatorContractEthereum

    const address = wallet.split(':')[1]

    const { provider } = await epnsAPIHelper.getInteractableContracts(
      network, // Network for which the interactable contract is req
      {
        // API Keys
        etherscanAPI: config.etherscanAPI,
        infuraAPI: config.infuraAPI,
        alchemyAPI: config.alchemyAPI
      },
      null, // Private Key of the Wallet
      contractAddress, // The contract address which is going to be used
      config.deployedCommunicatorContractABI // The contract abi which is going to be useds
    )

    const latestBlock = await provider.getBlockNumber()

    const req = `${config.etherScanUrl}api?module=account&action=txlist&address=${address}&startblock=0&endblock=${latestBlock}&page=1&sort=desc&apikey=${config.etherscanAPI}`
    const data = (await axios.get(req)).data.result

    //List of tx done by the account
    const accountTx = data.filter((tx) => tx.from.toLowerCase() === address.toLowerCase())

    for (let i = 0; i < accountTx.length; i++) {
      const res = await pubKeyHelper(provider, accountTx[i].hash, address)
      if (res.success) return res
    }
    return { success: false, keys: null }
  } catch (err) {
    return { success: false, keys: null }
  }
}
