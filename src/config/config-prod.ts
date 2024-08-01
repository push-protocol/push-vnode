import { ConfigEnvironment } from './types'

const sourceIds = {
  ethereumId: 'eip155:1',
  polygonId: 'eip155:137',
  graphId: 'THE_GRAPH',
  bscId: 'eip155:56',
  // fvmId: "eip155:314",
  arbitrumId: 'eip155:42161',
  videoId: 'PUSH_VIDEO',
  optimismId: 'eip155:10',
  polygonZkEVMId: 'eip155:1101',
  fuseId: 'eip155:122',
  lineaId: 'eip155:59144',
  cyberconnectId: 'eip155:7560',
  baseId: 'eip155:8453'
}

const deployedCommunicatorContracts = {
  ethereumAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  polygonAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  bscAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  arbitrumAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  optimismAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  polygonZkEVMAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  fuseAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  lineaAddress: '0x0d8e75CB5d8873c43c5d9Add71Fd71a09F7Ef890',
  cyberConnectAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  baseAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa'
}

const configProd: ConfigEnvironment = {
  /**
   * Server related config
   */
  maxDefaultAttempts: 3,
  /**
   * Trusted URLs, used as middleware for some and for future
   */
  trusterURLs: [
    'https://backend-kovan.epns.io',
    'https://backend-staging.epns.io',
    'https://backend-prod.epns.io',
    'https://backend.epns.io',
    'https://epns.io',
    'https://app.epns.io',
    'https://staging.epns.io',
    'https://dev.epns.io',
    'https://w2w.epns.io',
    'https://alpha.epns.io',
    'https://app.push.org',
    'https://staging.push.org',
    'https://dev.push.org',
    'https://w2w.push.org',
    'https://alpha.push.org',
    'https://analytics.push.org',
    'https://analytic.push.org',
    'https://analytics.push.network',
    'https://push.network'
  ],
  trustedIPs: [
    '54.159.26.252', // lens showrunners prod
    '44.213.26.119', // showrunners prod
    '87.101.95.184', // earnify
    '44.214.36.103', // uniswap showrunners prod
    '54.255.208.61' // slack health check prod
  ],
  trustedAccessToken: process.env.TRUSTED_ACCESS_TOKEN,
  /**
   * IPFS related
   */
  ipfsMaxAttempts: 3,
  subgraphMaxAttempts: 3,

  /**
   * Push Sockets related
   */
  socketMaxAllowedConnections: 10,

  /**
   * Protocol Meta related
   */
  protocolMeta: [
    { row: `${sourceIds.ethereumId}`, genesisBlock: 13888169 }, //ethereum
    { row: `${sourceIds.polygonId}`, genesisBlock: 23028042 }, //polygon
    { row: `${sourceIds.bscId}`, genesisBlock: 24673496 }, //bsc
    // {row: `${sourceIds.fvmId}`, genesisBlock: 24673496} , //fvm
    { row: `${sourceIds.arbitrumId}`, genesisBlock: 4785764 }, // Arbitrum
    { row: `${sourceIds.optimismId}`, genesisBlock: 6159590 }, // Optimism
    { row: `${sourceIds.polygonZkEVMId}`, genesisBlock: 6159590 }, // Polygon zk evm
    { row: `${sourceIds.fuseId}`, genesisBlock: 27280871 }, // fuse
    { row: `${sourceIds.lineaId}`, genesisBlock: 3146109 }, // linea
    { row: `${sourceIds.cyberconnectId}`, genesisBlock: 489086 }, // cyber connect
    { row: `${sourceIds.baseId}`, genesisBlock: 15443480 } // base
  ],
  awsSNSPublishLatestEpoch: 1640995200, // from 2022 Jan-1 , initializer

  /**
   * Web3 Related
   */
  ethereumId: sourceIds.ethereumId,
  ethereumChainId: 1,
  polygonId: sourceIds.polygonId,
  polygonChainId: 137,
  bscId: sourceIds.bscId,
  bscChainId: 56,
  // fvmId: sourceIds.fvmId,
  // fvmChainId: 314,
  arbitrumId: sourceIds.arbitrumId,
  arbitrumChainId: 42161,
  optimismId: sourceIds.optimismId,
  optimismChainId: 10,
  graphId: sourceIds.graphId,
  videoId: sourceIds.videoId,
  polygonZkEVMChainId: 1101,
  polygonZkEVMId: sourceIds.polygonZkEVMId,
  fuseId: sourceIds.fuseId,
  fuseChainId: 122,
  lineaId: sourceIds.lineaId,
  lineaChainId: 59144,
  cyberConnectId: sourceIds.cyberconnectId,
  cyberConnectChainId: 7560,
  baseId: sourceIds.baseId,
  baseChainId: 8453,

  supportedSourceTypes: [
    'ETH_MAINNET',
    'POLYGON_MAINNET',
    sourceIds.graphId,
    'BSC_MAINNET',
    'ARBITRUMONE_MAINNET',
    'OPTIMISM_MAINNET',
    // "FVM_MAINNET",
    sourceIds.videoId,
    'POLYGON_ZK_EVM_MAINNET',
    'FUSE_MAINNET',
    'LINEA_MAINNET',
    'CYBER_CONNECT_MAINNET',
    'BASE_MAINNET'
  ],

  MAP_ID_TO_BLOCKCHAIN: {
    1: 'eip155:1',
    137: 'eip155:137',
    56: 'eip155:56',
    42161: sourceIds.arbitrumId,
    10: sourceIds.optimismId,
    1101: sourceIds.polygonZkEVMId,
    122: sourceIds.fuseId,
    59144: sourceIds.lineaId,
    7560: sourceIds.cyberconnectId,
    8453: sourceIds.baseId
  },
  MAP_BLOCKCHAIN_TO_ID: {
    'eip155:1': 1,
    'eip155:137': 137,
    'eip155:56': 56,
    'eip155:42161': 42161,
    'eip155:10': 10,
    'eip155:1101': 1101,
    'eip155:122': 122,
    'eip155:59144': 59144,
    'eip155:7560': 7560,
    'eip155:8453': 8453
  },
  MAP_BLOCKCHAIN_STRING_TO_ID: {
    ETH_MAINNET: 1,
    THE_GRAPH: 1,
    POLYGON_MAINNET: 137,
    BSC_MAINNET: 56,
    ARBITRUMONE_MAINNET: 42161,
    OPTIMISM_MAINNET: 10,
    POLYGON_ZK_EVM_MAINNET: 1101,
    FUSE_MAINNET: 122,
    LINEA_MAINNET: 59144,
    CYBER_CONNECT_MAINNET: 7560,
    BASE_MAINNET: 8453
  },
  MAP_ID_TO_BLOCKCHAIN_STRING: {
    1: 'ETH_MAINNET',
    137: 'POLYGON_MAINNET',
    56: 'BSC_MAINNET',
    42161: 'ARBITRUMONE_MAINNET',
    10: 'OPTIMISM_MAINNET',
    1101: 'POLYGON_ZK_EVM_MAINNET',
    122: 'FUSE_MAINNET',
    59144: 'LINEA_MAINNET',
    7560: 'CYBER_CONNECT_MAINNET',
    8453: 'BASE_MAINNET'
  },
  MAP_BLOCKCHAIN_STRING_TO_CAIP: {
    ETH_MAINNET: 'eip155:1',
    POLYGON_MAINNET: 'eip155:137',
    BSC_MAINNET: 'eip155:56',
    ARBITRUMONE_MAINNET: 'eip155:42161',
    OPTIMISM_MAINNET: 'eip155:10',
    POLYGON_ZK_EVM_MAINNET: 'eip155:1101',
    FUSE_MAINNET: 'eip155:122',
    LINEA_MAINNET: 'eip155:59144',
    CYBER_CONNECT_MAINNET: 'eip155:7560',
    BASE_MAINNET: 'eip155:8453'
  },
  MAP_CAIP_TO_BLOCKCHAIN_STRING: {
    'eip155:1': 'ETH_MAINNET',
    'eip155:137': 'POLYGON_MAINNET',
    'eip155:56': 'BSC_MAINNET',
    'eip155:42161': 'ARBITRUMONE_MAINNET',
    'eip155:10': 'OPTIMISM_MAINNET',
    'eip155:1101': 'POLYGON_ZK_EVM_MAINNET',
    'eip155:122': 'FUSE_MAINNET',
    'eip155:59144': 'LINEA_MAINNET',
    'eip155:7560': 'CYBER_CONNECT_MAINNET',
    'eip155:8453': 'BASE_MAINNET'
  },
  web3EthereumNetwork: 'homestead',
  web3PolygonNetwork: 'matic',
  web3BscNetwork: 'bnb',
  // web3FvmNetwork: "fvm",
  web3ArbitrumNetwork: 'arbitrumone',
  web3OptimismNetwork: 'optimismmainnet',
  web3PolygonZkEVMNetwork: 'polygonzkevmmainnet',
  web3FuseNetwork: 'fusemainnet',
  web3LineaNetwork: 'lineamainnet',
  web3CyberConnectNetwork: 'cyberconnectmainnet',
  web3BaseNetwork: 'basemainnet',
  web3PolygonProvider: process.env.POLYGON_MAINNET_WEB3_PROVIDER,
  web3PolygonSocket: process.env.POLYGON_MAINNET_MOLASIS_WEB3_SOCKET,
  web3BscProvider: process.env.BSC_MAINNET_WEB3_PROVIDER,
  web3BscSocket: process.env.BSC_MAINNET_WEB3_SOCKET,
  // web3FvmProvider: process.env.FVM_MAINNET_WEB3_PROVIDER,
  // web3FvmSocket: process.env.FVM_MAINNET_WEB3_SOCKET,
  web3ArbitrumProvider: process.env.ARBITRUM_ONE_MAINNET_WEB3_PROVIDER,
  web3ArbitrumSocket: process.env.ARBITRUM_ONE_MAINNET_WEB3_SOCKET,
  web3OptimismProvider: process.env.OPTIMISM_MAINNET_WEB3_PROVIDER,
  web3OptimismSocket: process.env.OPTIMISM_MAINNET_WEB3_SOCKET,
  web3EthereumProvider: process.env.ETH_MAINNET_WEB3_PROVIDER,
  web3EthereumSocket: process.env.ETH_MAINNET_WEB3_SOCKET,
  web3PolygonZkEVMProvider: process.env.POLYGON_ZK_EVM_MAINNET_WEB3_PROVIDER,
  web3PolygonZkEVMSocket: process.env.POLYGON_ZK_EVM_MAINNET_WEB3_SOCKET,
  web3FuseProvider: process.env.FUSE_MAINNET_WEB3_PROVIDER,
  web3FuseSocket: process.env.FUSE_MAINNET_WEB3_SOCKET,
  web3LineaProvider: process.env.LINEA_MAINNET_WEB3_PROVIDER,
  web3LineaSocket: process.env.LINEA_MAINNET_WEB3_SOCKET,
  web3CyberConnectProvider: process.env.CYBER_CONNECT_MAINNET_WEB3_PROVIDER,
  web3CyberConnectSocket: process.env.CYBER_CONNECT_MAINNET_WEB3_SOCKET,
  web3BaseProvider: process.env.BASE_TESTNET_WEB3_PROVIDER,
  web3BaseSocket: process.env.BASE_TESTNET_WEB3_SOCKET,

  supportAliasChains: [137, 56, 42161, 10, 1101, 122, 59144, 7560, 8453],
  supportedAliasIds: [
    'eip155:137',
    'eip155:56',
    // 'eip155:314',
    'eip155:42161',
    'eip155:10',
    'eip155:1101',
    'eip155:122',
    'eip155:59144',
    'eip155:7560',
    'eip155:8453'
  ],
  supportedCAIP: [
    'eip155:1',
    'eip155:137',
    'eip155:56',
    // 'eip155:314',
    'eip155:42161',
    'eip155:10',
    'eip155:1101',
    'eip155:122',
    'eip155:59144',
    'eip155:7560',
    'eip155:8453'
  ],

  /**
   * EPNS Related
   */
  deployedCommunicatorContractEthereum: deployedCommunicatorContracts.ethereumAddress,
  deployedCommunicatorContractPolygon: deployedCommunicatorContracts.polygonAddress,
  deployedCommunicatorContractBsc: deployedCommunicatorContracts.bscAddress,
  // deployedCommunicatorContractFvm:"0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa",
  deployedCommunicatorContractArbitrum: deployedCommunicatorContracts.arbitrumAddress, //TODO: Change it later
  deployedCommunicatorContractOptimism: deployedCommunicatorContracts.arbitrumAddress,
  deployedCommunicatorContractPolygonZkEVM: deployedCommunicatorContracts.polygonZkEVMAddress,
  deployedCommunicatorContractFuse: deployedCommunicatorContracts.fuseAddress,
  deployedCommunicatorContractLinea: deployedCommunicatorContracts.lineaAddress,
  deployedCommunicatorContractCyberConnect: deployedCommunicatorContracts.cyberConnectAddress,
  deployedCommunicatorContractBase: deployedCommunicatorContracts.baseAddress,
  deployedCommunicatorContractABI: require('./epns_communicator.json'),

  deployedCoreContract: '0x66329Fdd4042928BfCAB60b179e1538D56eeeeeE',
  deployedCoreContractABI: require('./epns_core.json'),
  epnsAdminChannel: 'eip155:1:0xB88460Bb2696CAb9D66013A05dFF29a28330689D',

  MAP_ID_TO_COMM_CONTRACT: {
    1: deployedCommunicatorContracts.ethereumAddress,
    137: deployedCommunicatorContracts.polygonAddress,
    56: deployedCommunicatorContracts.bscAddress,
    // 314:"0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa",
    42161: deployedCommunicatorContracts.arbitrumAddress, ////TODO: Change it later,
    10: deployedCommunicatorContracts.optimismAddress,
    1101: deployedCommunicatorContracts.polygonZkEVMAddress,
    122: deployedCommunicatorContracts.fuseAddress,
    59144: deployedCommunicatorContracts.lineaAddress,
    7560: deployedCommunicatorContracts.cyberConnectAddress,
    8453: deployedCommunicatorContracts.baseAddress
  },

  // CHAIN_ID_TO_PROVIDER_MAPPING
  CHAIN_ID_TO_PROVIDER: {
    1: process.env.ETH_MAINNET_WEB3_PROVIDER,
    137: process.env.POLYGON_MAINNET_WEB3_PROVIDER,
    56: process.env.BSC_MAINNET_WEB3_PROVIDER,
    42161: process.env.ARBITRUM_ONE_MAINNET_WEB3_PROVIDER,
    10: process.env.OPTIMISM_MAINNET_WEB3_PROVIDER,
    1101: process.env.POLYGON_ZK_EVM_MAINNET_WEB3_PROVIDER,
    122: process.env.FUSE_MAINNET_WEB3_PROVIDER,
    59144: process.env.LINEA_MAINNET_WEB3_PROVIDER,
    7560: process.env.CYBER_CONNECT_MAINNET_WEB3_PROVIDER,
    8453: process.env.BASE_TESTNET_WEB3_PROVIDER
  },
  SOCKET_ARRAY: [
    process.env.ETH_MAINNET_WEB3_SOCKET,
    process.env.POLYGON_MAINNET_MOLASIS_WEB3_SOCKET,
    process.env.BSC_MAINNET_WEB3_SOCKET,
    process.env.ARBITRUM_ONE_MAINNET_WEB3_SOCKET,
    process.env.OPTIMISM_MAINNET_WEB3_SOCKET,
    process.env.POLYGON_ZK_EVM_MAINNET_WEB3_SOCKET,
    process.env.FUSE_MAINNET_WEB3_SOCKET,
    process.env.LINEA_MAINNET_WEB3_SOCKET,
    process.env.CYBER_CONNECT_MAINNET_WEB3_SOCKET,
    process.env.BASE_MAINNET_WEB3_SOCKET
  ],

  COMM_CONTRACT_ARRAY: [
    deployedCommunicatorContracts.ethereumAddress,
    deployedCommunicatorContracts.polygonAddress,
    deployedCommunicatorContracts.bscAddress,
    deployedCommunicatorContracts.arbitrumAddress,
    deployedCommunicatorContracts.optimismAddress,
    deployedCommunicatorContracts.polygonZkEVMAddress,
    deployedCommunicatorContracts.fuseAddress,
    deployedCommunicatorContracts.lineaAddress,
    deployedCommunicatorContracts.cyberConnectAddress,
    deployedCommunicatorContracts.baseAddress
  ],

  /** NPIP Block Genesis*/
  // TBD: Block Number
  NPIPImplemenationBlockEth: 15546381,
  NPIPImplemenationBlockPolygon: 33179132,
  NPIPImplemenationBlockBsc: 24673496,
  //TODO: change it to appropriate block number
  // NPIPImplemenationBlockFvm: 4 ,
  NPIPImplemenationBlockArbitrum: 4785764, //TODO: Change it later
  NPIPImplemenationBlockOptimism: 6159590,
  NPIPImplemenationBlockPolygonZkEVM: 6159590,
  NPIPImplemenationBlockFuse: 27280871,
  NPIPImplemenationBlockLinea: 3146109,
  NPIPImplemenationBlockBase: 15443480,
  NPIPImplementationBlockCyberConnect: 489086,
  /** SNS AWS CREDENTIALS*/

  SNS_AWS_ACCESS_KEY: process.env.SNS_AWS_ACCESS_KEY,
  SNS_AWS_SECRET_KEY: process.env.SNS_AWS_SECRET_KEY,
  SNS_AWS_REGION: process.env.SNS_AWS_REGION,
  SNS_AWS_TOPIC_ARN: process.env.SNS_AWS_TOPIC_ARN,
  SNS_INTEGRATION_ENABLED: process.env.SNS_INTEGRATION_ENABLED,

  // Redis URL
  REDIS_URL: process.env.REDIS_URL,
  TOKEN_KEY: process.env.TOKEN_KEY,

  /** API Authentication Creds */
  DEFAULT_AUTH_USERNAME: process.env.DEFAULT_AUTH_USERNAME,
  DEFAULT_AUTH_PASSWORD: process.env.DEFAULT_AUTH_PASSWORD,

  /** Delivery Node Related */
  DELIVERY_NODE_URL: process.env.DELIVERY_NODE_URL,

  /** Notification Realted */
  SUBSET_NOTIF_LIMIT: 1000
}

export default configProd
