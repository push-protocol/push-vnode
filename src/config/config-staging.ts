import { ConfigEnvironment } from './types'

const sourceIds = {
  ethereumId: 'eip155:11155111',
  polygonId: 'eip155:80002',
  graphId: 'THE_GRAPH',
  bscId: 'eip155:97',
  // fvmId: "eip155:3141",
  arbitrumId: 'eip155:421614',
  optimismId: 'eip155:11155420',
  videoId: 'PUSH_VIDEO',
  polygonZkEVMId: 'eip155:2442',
  fuseId: 'eip155:123',
  lineaChainId: 'eip155:59141',
  cyberconnectId: 'eip155:111557560',
  berachainId: 'eip155:80085',
  baseId: 'eip155:84532',
  simulateId: 'SIMULATE'
}

const deployedCommunicatorContracts = {
  ethereumAddress: '0x0c34d54a09cfe75bccd878a469206ae77e0fe6e7',
  polygonAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  bscAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  arbitrumAddress: '0x9Dc25996ba72A2FD7E64e7a674232a683f406F1A',
  optimismAddress: '0x9Dc25996ba72A2FD7E64e7a674232a683f406F1A',
  polygonZkEVMAddress: '0x6e489B7af21cEb969f49A90E481274966ce9D74d',
  fuseAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  lineaAddress: '0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa',
  cyberConnectAddress: '0x6e489B7af21cEb969f49A90E481274966ce9D74d',
  berachainAddress: '0x7b9C405e261ba671f008c20D0321f62d08C140EC',
  baseAddress: '0x6e489B7af21cEb969f49A90E481274966ce9D74d'
}

const configStaging: ConfigEnvironment = {
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
    '34.202.100.92', //lens staging
    '54.165.247.106', //showrunners staging
    '54.146.196.198' //wallet tracker staging
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
    { row: `${sourceIds.ethereumId}`, genesisBlock: 4658135 }, //ethereum
    { row: `${sourceIds.polygonId}`, genesisBlock: 5391420 }, //polygon
    { row: `${sourceIds.bscId}`, genesisBlock: 26233387 }, //bsc

    // {row: `${sourceIds.fvmId}`, genesisBlock: 25296872} , //fvm
    { row: `${sourceIds.arbitrumId}`, genesisBlock: 18941411 }, // Arbitrum
    { row: `${sourceIds.optimismId}`, genesisBlock: 8751193 }, // Optimism
    { row: `${sourceIds.polygonZkEVMId}`, genesisBlock: 2497786 }, // zkEVM
    { row: `${sourceIds.fuseId}`, genesisBlock: 13708535 }, // fuse
    { row: `${sourceIds.lineaChainId}`, genesisBlock: 101144 }, // linea
    { row: `${sourceIds.cyberconnectId}`, genesisBlock: 489086 }, // cyber connect
    { row: `${sourceIds.berachainId}`, genesisBlock: 572465 }, // berachain
    { row: `${sourceIds.baseId}`, genesisBlock: 10903185 } // basechain
  ],
  awsSNSPublishLatestEpoch: 1640995200, // from 2022 Jan-1 , initializer

  /**
   * Web3 Related
   */
  ethereumId: sourceIds.ethereumId,
  ethereumChainId: 11155111,
  polygonId: sourceIds.polygonId,
  polygonChainId: 80002,
  bscId: sourceIds.bscId,
  bscChainId: 97,
  // fvmId: sourceIds.fvmId,
  // fvmChainId: 3141,
  arbitrumId: sourceIds.arbitrumId,
  arbitrumChainId: 421614,
  graphId: sourceIds.graphId,
  videoId: sourceIds.videoId,
  simulateId: sourceIds.simulateId,
  optimismId: sourceIds.optimismId,
  optimismChainId: 11155420,
  polygonZkEVMId: sourceIds.polygonZkEVMId,
  polygonZkEVMChainId: 2442,
  fuseId: sourceIds.fuseId,
  fuseChainId: 123,
  cyberConnectId: sourceIds.cyberconnectId,
  cyberConnectChainId: 111557560,
  berachainId: sourceIds.berachainId,
  berachainChainId: 80085,
  lineaId: sourceIds.lineaChainId,
  lineaChainId: 59141,
  baseId: sourceIds.baseId,
  baseChainId: 84532,

  supportedSourceTypes: [
    'ETH_TEST_SEPOLIA',
    'POLYGON_TEST_AMOY',
    sourceIds.graphId,
    'BSC_TESTNET',
    'ARBITRUM_TESTNET',
    'OPTIMISM_TESTNET',
    // "FVM_TESTNET",
    sourceIds.videoId,
    'POLYGON_ZK_EVM_TESTNET',
    'FUSE_TESTNET',
    'LINEA_SEPOLIA_TESTNET',
    'CYBER_CONNECT_TESTNET',
    'BERACHAIN_TESTNET',
    'BASE_TESTNET'
  ],
  MAP_ID_TO_BLOCKCHAIN: {
    11155111: sourceIds.ethereumId,
    80002: sourceIds.polygonId,
    97: sourceIds.bscId,
    421614: sourceIds.arbitrumId,
    11155420: sourceIds.optimismId,
    2442: sourceIds.polygonZkEVMId,
    123: sourceIds.fuseId,
    59141: sourceIds.lineaChainId,
    111557560: sourceIds.cyberconnectId,
    80085: sourceIds.berachainId,
    84532: sourceIds.baseId
  },
  MAP_BLOCKCHAIN_TO_ID: {
    'eip155:11155111': 11155111,
    'eip155:80002': 80002,
    'eip155:97': 97,
    'eip155:421614': 421614,
    'eip155:11155420': 11155420,
    'eip155:2442': 2442,
    'eip155:123': 123,
    'eip155:59141': 59141,
    'eip155:111557560': 111557560,
    'eip155:80085': 80085,
    'eip155:84532': 84532
  },
  MAP_BLOCKCHAIN_STRING_TO_ID: {
    ETH_TEST_SEPOLIA: 11155111,
    THE_GRAPH: 11155111,
    POLYGON_TEST_AMOY: 80002,
    BSC_TESTNET: 97,
    ARBITRUM_TESTNET: 421614,
    OPTIMISM_TESTNET: 11155420,
    POLYGON_ZK_EVM_TESTNET: 2442,
    SIMULATE: 11155111,
    FUSE_TESTNET: 123,
    LINEA_SEPOLIA_TESTNET: 59141,
    CYBER_CONNECT_TESTNET: 111557560,
    BERACHAIN_TESTNET: 80085,
    BASE_TESTNET: 84532
  },
  MAP_ID_TO_BLOCKCHAIN_STRING: {
    11155111: 'ETH_TEST_SEPOLIA',
    80002: 'POLYGON_TEST_AMOY',
    97: 'BSC_TESTNET',
    421614: 'ARBITRUM_TESTNET',
    11155420: 'OPTIMISM_TESTNET',
    2442: 'POLYGON_ZK_EVM_TESTNET',
    123: 'FUSE_TESTNET',
    59141: 'LINEA_SEPOLIA_TESTNET',
    111557560: 'CYBER_CONNECT_TESTNET',
    80085: 'BERACHAIN_TESTNET',
    84532: 'BASE_TESTNET'
  },
  MAP_BLOCKCHAIN_STRING_TO_CAIP: {
    ETH_TEST_SEPOLIA: 'eip155:11155111',
    POLYGON_TEST_AMOY: 'eip155:80002',
    BSC_TESTNET: 'eip155:97',
    ARBITRUM_TESTNET: 'eip155:421614',
    OPTIMISM_TESTNET: 'eip155:11155420',
    POLYGON_ZK_EVM_TESTNET: 'eip155:2442',
    FUSE_TESTNET: 'eip155:123',
    LINEA_SEPOLIA_TESTNET: 'eip155:59141',
    CYBER_CONNECT_TESTNET: 'eip155:111557560',
    BERACHAIN_TESTNET: 'eip155:80085',
    BASE_TESTNET: 'eip155:84532'
  },
  MAP_CAIP_TO_BLOCKCHAIN_STRING: {
    'eip155:11155111': 'ETH_TEST_SEPOLIA',
    'eip155:80002': 'POLYGON_TEST_AMOY',
    'eip155:97': 'BSC_TESTNET',
    'eip155:421614': 'ARBITRUM_TESTNET',
    'eip155:11155420': 'OPTIMISM_TESTNET',
    'eip155:2442': 'POLYGON_ZK_EVM_TESTNET',
    'eip155:123': 'FUSE_TESTNET',
    'eip155:59141': 'LINEA_SEPOLIA_TESTNET',
    'eip155:111557560': 'CYBER_CONNECT_TESTNET',
    'eip155:80085': 'BERACHAIN_TESTNET',
    'eip155:84532': 'BASE_TESTNET'
  },
  web3EthereumNetwork: 'sepolia',
  web3PolygonNetwork: 'maticamoy',
  web3BscNetwork: 'bsctest',
  // web3FvmNetwork: "fvmtest",
  web3ArbitrumNetwork: 'arbitrumtestnet',
  web3OptimismNetwork: 'optimismtestnet',
  web3PolygonZkEVMNetwork: 'polygonzkevmtestnet',
  web3FuseNetwork: 'fusetestnet',
  web3BerachainNetwork: 'berachiantestnet',
  web3LineaNetwork: 'lineatestnet',
  web3CyberConnectNetwork: 'cyberconnectnetwork',
  web3BaseNetwork: 'basetestnet',
  // PROVIDERS AND SOCKET
  web3OptimismProvider: process.env.OPTIMISM_SEPOLIA_TESTNET_WEB3_PROVIDER,
  web3OptimismSocket: process.env.OPTIMISM_SEPOLIA_TESTNET_WEB3_SOCKET,
  web3ArbitrumProvider: process.env.ARBITRUM_SEPOLIA_TESTNET_WEB3_PROVIDER,
  web3ArbitrumSocket: process.env.ARBITRUM_SEPOLIA_TESTNET_WEB3_SOCKET,
  // web3FvmProvider: process.env.FVM_TESTNET_WEB3_PROVIDER,
  // web3FvmSocket: process.env.FVM_TESTNET_WEB3_SOCKET,
  web3PolygonProvider: process.env.POLYGON_AMOY_TESTNET_WEB3_PROVIDER,
  web3PolygonSocket: process.env.POLYGON_AMOY_TESTNET_WEB3_SOCKET,
  web3BscProvider: process.env.BSC_TESTNET_WEB3_PROVIDER,
  web3BscSocket: process.env.BSC_TESTNET_WEB3_SOCKET,
  web3EthereumProvider: process.env.ETH_SEPOLIA_WEB3_PROVIDER,
  web3EthereumSocket: process.env.ETH_SEPOLIA_WEB3_SOCKET,
  web3PolygonZkEVMProvider: process.env.POLYGON_ZK_EVM_TESTNET_WEB3_PROVIDER,
  web3PolygonZkEVMSocket: process.env.POLYGON_ZK_EVM_TESTNET_WEB3_SOCKET,
  web3FuseProvider: process.env.FUSE_TESTNET_WEB3_PROVIDER,
  web3FuseSocket: process.env.FUSE_TESTNET_WEB3_SOCKET,
  web3CyberConnectProvider: process.env.CYBER_CONNECT_TESTNET_WEB3_PROVIDER,
  web3CyberConnectSocket: process.env.CYBER_CONNECT_TESTNET_WEB3_SOCKET,
  web3BerachainProvider: process.env.BERACHAIN_TESTNET_WEB3_PROVIDER,
  web3BerachainSocket: process.env.BERACHAIN_TESTNET_WEB3_SOCKET,
  web3LineaProvider: process.env.LINEA_TESTNET_WEB3_PROVIDER,
  web3LineaSocket: process.env.LINEA_TESTNET_WEB3_SOCKET,
  web3BaseProvider: process.env.BASE_TESTNET_WEB3_PROVIDER,
  web3BaseSocket: process.env.BASE_TESTNET_WEB3_SOCKET,

  // CHAIN_ID_TO_PROVIDER_MAPPING
  CHAIN_ID_TO_PROVIDER: {
    11155111: process.env.ETH_SEPOLIA_WEB3_PROVIDER,
    80002: process.env.POLYGON_AMOY_TESTNET_WEB3_PROVIDER,
    97: process.env.BSC_TESTNET_WEB3_PROVIDER,
    421614: process.env.ARBITRUM_SEPOLIA_TESTNET_WEB3_PROVIDER,
    11155420: process.env.OPTIMISM_SEPOLIA_TESTNET_WEB3_PROVIDER,
    2442: process.env.POLYGON_ZK_EVM_TESTNET_WEB3_PROVIDER,
    123: process.env.FUSE_TESTNET_WEB3_PROVIDER,
    59141: process.env.LINEA_TESTNET_WEB3_PROVIDER,
    111557560: process.env.CYBER_CONNECT_TESTNET_PROVIDER,
    80085: process.env.BERACHAIN_TESTNET_WEB3_PROVIDER,
    84532: process.env.BASE_TESTNET_WEB3_PROVIDER
  },
  SOCKET_ARRAY: [
    process.env.ETH_SEPOLIA_WEB3_SOCKET,
    process.env.POLYGON_AMOY_TESTNET_WEB3_SOCKET,
    process.env.BSC_TESTNET_WEB3_SOCKET,
    process.env.ARBITRUM_SEPOLIA_TESTNET_WEB3_SOCKET,
    process.env.OPTIMISM_SEPOLIA_TESTNET_WEB3_SOCKET,
    process.env.POLYGON_ZK_EVM_TESTNET_WEB3_SOCKET,
    process.env.FUSE_TESTNET_WEB3_SOCKET,
    process.env.LINEA_TESTNET_WEB3_SOCKET,
    process.env.CYBER_CONNECT_TESTNET_WEB3_SOCKET,
    process.env.BERACHAIN_TESTNET_WEB3_SOCKET,
    process.env.BASE_TESTNET_WEB3_SOCKET
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
    deployedCommunicatorContracts.berachainAddress,
    deployedCommunicatorContracts.baseAddress
  ],

  // SUPPORTED ALIAS AND CAIPS
  supportAliasChains: [
    80002, 97, 3141, 421614, 11155420, 2442, 123, 59141, 111557560, 80085, 84532
  ],
  supportedAliasIds: [
    'eip155:80002',
    'eip155:97',
    'eip155:421614',
    'eip155:11155420',
    'eip155:2442',
    'eip155:123',
    'eip155:59141',
    'eip155:111557560',
    'eip155:80085',
    'eip155:84532'
  ],
  supportedCAIP: [
    'eip155:11155111',
    'eip155:80002',
    'eip155:97',
    'eip155:421614',
    'eip155:11155420',
    'eip155:2442',
    'eip155:123',
    'eip155:59141',
    'eip155:111557560',
    'eip155:80085',
    'eip155:84532'
  ],

  /**
   * EPNS Related
   */
  // PUSH COMM CONTRACTS
  deployedCommunicatorContractEthereum: deployedCommunicatorContracts.ethereumAddress,
  deployedCommunicatorContractPolygon: deployedCommunicatorContracts.polygonAddress,
  deployedCommunicatorContractBsc: deployedCommunicatorContracts.bscAddress,
  // deployedCommunicatorContractFvm:"tbd",
  deployedCommunicatorContractArbitrum: deployedCommunicatorContracts.arbitrumAddress,
  deployedCommunicatorContractOptimism: deployedCommunicatorContracts.optimismAddress,
  deployedCommunicatorContractPolygonZkEVM: deployedCommunicatorContracts.polygonZkEVMAddress,
  deployedCommunicatorContractFuse: deployedCommunicatorContracts.fuseAddress,
  deployedCommunicatorContractCyberConnect: deployedCommunicatorContracts.cyberConnectAddress,
  deployedCommunicatorContractBerachain: deployedCommunicatorContracts.berachainAddress,
  deployedCommunicatorContractLinea: deployedCommunicatorContracts.lineaAddress,
  deployedCommunicatorContractBase: deployedCommunicatorContracts.baseAddress,
  deployedCommunicatorContractABI: require('./epns_communicator_staging.json'),

  // PUSH CORE CONTRACTS
  deployedCoreContract: '0x9d65129223451fbd58fc299c635cd919baf2564c',
  deployedCoreContractABI: require('./epns_core_staging.json'),
  epnsAdminChannel: 'eip155:11155111:0x74415Bc4C4Bf4Baecc2DD372426F0a1D016Fa924',

  MAP_ID_TO_COMM_CONTRACT: {
    11155111: deployedCommunicatorContracts.ethereumAddress,
    80002: deployedCommunicatorContracts.polygonAddress,
    97: deployedCommunicatorContracts.bscAddress,
    // 3141: "tbd",
    421614: deployedCommunicatorContracts.arbitrumAddress,
    11155420: deployedCommunicatorContracts.optimismAddress,
    2442: deployedCommunicatorContracts.polygonZkEVMAddress,
    123: deployedCommunicatorContracts.fuseAddress,
    59141: deployedCommunicatorContracts.lineaAddress,
    111557560: deployedCommunicatorContracts.cyberConnectAddress,
    80085: deployedCommunicatorContracts.berachainAddress,
    84532: deployedCommunicatorContracts.baseAddress
  },

  /** NPIP Block Genesis*/
  // TBD: Block Number
  NPIPImplemenationBlockEth: 4658135,
  NPIPImplemenationBlockPolygon: 5391420,
  NPIPImplemenationBlockBsc: 3,
  // NPIPImplemenationBlockFvm: 4 ,
  NPIPImplemenationBlockArbitrum: 18941411,
  NPIPImplemenationBlockOptimism: 8751193,
  NPIPImplemenationBlockPolygonZkEVM: 2497786,
  NPIPImplemenationBlockFuse: 13708535,
  NPIPImplementationBlockCyberConnect: 489086,
  NPIPImplemenationBlockBerachain: 572465,
  NPIPImplemenationBlockLinea: 101144,
  NPIPImplemenationBlockBase: 10903185,

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

export default configStaging
