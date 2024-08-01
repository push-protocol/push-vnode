import { recoverTypedSignature_v4 as recoverTypedSignatureV4 } from 'eth-sig-util'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../config/index'

interface Domain {
  name?: string
  chainId?: string
  verifyingContract?: string
}

interface Message {
  data: string
}

export function verifyEip712ProofV2(
  signature: string,
  verifyingData: string,
  chainId: string = config.ethereumChainId,
  verifyingContract: string = config.deployedCommunicatorContractEthereum,
  isDomainEmpty: boolean = false,
  domainName: string = 'EPNS COMM V1'
): string | boolean {
  const logger: Logger = Container.get('logger')

  try {
    const message: Message = { data: verifyingData }

    const domain: Domain = isDomainEmpty
      ? {}
      : {
          name: domainName,
          chainId: chainId,
          verifyingContract: verifyingContract
        }

    const types = {
      EIP712Domain: isDomainEmpty
        ? []
        : [
            { name: 'name', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
          ],
      Data: [{ name: 'data', type: 'string' }]
    }

    const typedData = {
      types,
      domain,
      primaryType: 'Data',
      message
    }

    const recoveredAddress = recoverTypedSignatureV4({
      data: typedData,
      sig: signature
    })

    return recoveredAddress
  } catch (error) {
    logger.error('An error occurred while verifying the signature:', error)
    return false
  }
}
