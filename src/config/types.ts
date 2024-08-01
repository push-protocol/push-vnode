export interface ProtocolMeta {
  row: string
  genesisBlock: number
}

export interface ConfigEnvironment {
  /**
   * Server related config
   */
  maxDefaultAttempts: number
  /**
   * Trusted URLs, used as middleware for some and for future
   */
  trusterURLs: string[]

  trustedIPs: string[]

  trustedAccessToken: string

  /**
   * IPFS related
   */
  ipfsMaxAttempts: number
  subgraphMaxAttempts: number

  /**
   * Push Sockets related
   */
  socketMaxAllowedConnections: number

  /**
   * Protocol Meta related
   */
  protocolMeta: ProtocolMeta[]
  awsSNSPublishLatestEpoch: number // from 2022 Jan-1 , initializer

  /**
   * Web3 Related
   */
  ethereumId: string
  ethereumChainId: number
  polygonId: string
  polygonChainId: number
  bscId: string
  bscChainId: number
  // fvmId: string,
  // fvmChainId: number,
  arbitrumId: string
  arbitrumChainId: number
  optimismId: string
  optimismChainId: number
  polygonZkEVMId: string
  polygonZkEVMChainId: number
  graphId: string
  videoId: string
  simulateId?: string
  fuseId: string
  fuseChainId: number
  berachainId?: string
  berachainChainId?: number
  lineaId: string
  lineaChainId: number
  cyberConnectId: string
  cyberConnectChainId: number
  baseId: string
  baseChainId: number

  supportedSourceTypes: string[]
  MAP_ID_TO_BLOCKCHAIN: Record<number, string>
  MAP_BLOCKCHAIN_TO_ID: Record<string, number>
  MAP_BLOCKCHAIN_STRING_TO_ID: Record<string, number>
  MAP_ID_TO_BLOCKCHAIN_STRING: Record<number, string>
  MAP_BLOCKCHAIN_STRING_TO_CAIP: Record<string, string>
  MAP_CAIP_TO_BLOCKCHAIN_STRING: Record<string, string>
  web3EthereumNetwork: string
  web3PolygonNetwork: string
  web3BscNetwork: string
  // web3FvmNetwork: string,
  web3ArbitrumNetwork: string
  web3OptimismNetwork: string
  web3FuseNetwork: string
  web3BerachainNetwork?: string
  web3LineaNetwork: string
  web3PolygonZkEVMNetwork: string
  // PROVIDERS AND SOCKET
  web3OptimismProvider: string
  web3OptimismSocket: string
  web3ArbitrumProvider: string
  web3ArbitrumSocket: string
  // web3FvmProvider: string,
  // web3FvmSocket: string,
  web3PolygonProvider: string
  web3PolygonSocket: string
  web3BscProvider: string
  web3BscSocket: string
  web3EthereumProvider: string
  web3EthereumSocket: string
  web3PolygonZkEVMProvider: string
  web3PolygonZkEVMSocket: string
  web3FuseProvider: string
  web3FuseSocket: string
  web3BerachainProvider?: string
  web3BerachainSocket?: string
  web3LineaProvider: string
  web3LineaSocket: string
  web3CyberConnectNetwork: string
  web3CyberConnectProvider: string
  web3CyberConnectSocket: string
  web3BaseNetwork: string
  web3BaseProvider: string
  web3BaseSocket: string
  // CHAIN_ID_TO_PROVIDER_MAPPING
  CHAIN_ID_TO_PROVIDER: Record<number, string>

  // SUPPORTED ALIAS AND CAIPS
  supportAliasChains: number[]
  supportedAliasIds: string[]
  supportedCAIP: string[]

  /**
   * EPNS Related
   */
  // PUSH COMM CONTRACTS
  deployedCommunicatorContractEthereum: string
  deployedCommunicatorContractPolygon: string
  deployedCommunicatorContractBsc: string
  // deployedCommunicatorContractFvm:string,
  deployedCommunicatorContractArbitrum: string
  deployedCommunicatorContractOptimism: string
  deployedCommunicatorContractPolygonZkEVM: string
  deployedCommunicatorContractABI: string
  deployedCommunicatorContractFuse: string
  deployedCommunicatorContractBerachain?: string
  deployedCommunicatorContractLinea: string
  deployedCommunicatorContractCyberConnect: string
  deployedCommunicatorContractBase: string
  // PUSH CORE CONTRACTS
  deployedCoreContract: string
  deployedCoreContractABI: string

  epnsAdminChannel: string

  MAP_ID_TO_COMM_CONTRACT: Record<number, string>

  /** NPIP Block Genesis*/
  NPIPImplemenationBlockEth: number
  NPIPImplemenationBlockPolygon: number
  NPIPImplemenationBlockBsc: number
  // NPIPImplemenationBlockFvm: number ,
  NPIPImplemenationBlockArbitrum: number
  NPIPImplemenationBlockOptimism: number
  NPIPImplemenationBlockPolygonZkEVM: number
  NPIPImplemenationBlockFuse: number
  NPIPImplemenationBlockBerachain?: number
  NPIPImplemenationBlockLinea: number
  NPIPImplementationBlockCyberConnect: number
  NPIPImplemenationBlockBase: number
  /** SNS AWS CREDENTIALS*/

  SNS_AWS_ACCESS_KEY: string
  SNS_AWS_SECRET_KEY: string
  SNS_AWS_REGION: string
  SNS_AWS_TOPIC_ARN: string
  SNS_INTEGRATION_ENABLED: string

  // Redis URL
  REDIS_URL: string
  TOKEN_KEY: string

  /** API Authentication Creds */
  DEFAULT_AUTH_USERNAME: string
  DEFAULT_AUTH_PASSWORD: string

  /** Delivery Node Related */
  DELIVERY_NODE_URL: string

  /** Notification Realted */
  SUBSET_NOTIF_LIMIT: number
  SOCKET_ARRAY: string[]
  COMM_CONTRACT_ARRAY: string[]
}
