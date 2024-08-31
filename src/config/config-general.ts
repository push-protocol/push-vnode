const env = process.env.NODE_ENV || 'local'
const staticServeURI = 'public'
const staticCacheURI = 'cache'
const fsServeURL = {
  prod: `https://backend.epns.io/${staticCacheURI}`,
  staging: `https://backend-staging.epns.io/${staticCacheURI}`,
  dev: `https://backend-dev.epns.io/${staticCacheURI}`,
  local: `http://localhost:4000/${staticCacheURI}`
}

const backendURL = {
  PROD: 'https://backend.epns.io',
  STAGING: 'https://backend-staging.epns.io',
  DEV: 'https://backend-dev.epns.io',
  LOCAL: 'http://localhost:4000'
}
const pushNodesNet = process.env.PUSH_NODES_NET
export default {
  /**
   * Migration Version, numeric and will keep on increasing based on architecture migration
   */
  migrationVersion: 70,
  /**
   * Your favorite port
   */
  environment: env,
  pushNodesNet: pushNodesNet,
  port: parseInt(process.env.PORT || '3000', 10),
  runningOnMachine: process.env.RUNNING_ON_MACHINE,
  enableDynamicLogs: true,

  /**
   * Used by winston logger
   */
  logs: {
    level: process.env.LOG_LEVEL || 'silly'
  },

  /**
   * The database config
   */
  dbhost: process.env.DB_HOST,
  dbname: process.env.DB_NAME,
  dbuser: process.env.DB_USER,
  dbpass: process.env.DB_PASS,
  charset: 'utf8mb4',

  /**
   * File system config
   */
  fsServerURL:
    pushNodesNet === 'PROD'
      ? fsServeURL.prod
      : pushNodesNet === 'DEV'
      ? fsServeURL.dev
      : fsServeURL.staging,
  staticServePath: staticServeURI,
  staticCachePath: `${__dirname}/../../${staticServeURI}/${staticCacheURI}/`,
  staticAppPath: `${__dirname}/../../`,

  backendURL: backendURL[pushNodesNet],

  /**
   * Web3 Related
   */
  etherscanAPI: process.env.ETHERSCAN_API,
  etherScanUrl:
    pushNodesNet === 'PROD' ? 'https://api.etherscan.io/' : 'https://api-goerli.etherscan.io/',

  infuraAPI: {
    projectID: process.env.INFURA_PROJECT_ID,
    projectSecret: process.env.INFURA_PROJECT_SECRET
  },

  alchemyAPI: process.env.ALCHEMY_API,

  /**
   * IPFS related
   */
  ipfsGateway: 'https://epns-testing.infura-ipfs.io/ipfs/',
  web3StorageToken: process.env.WEB3_STORAGE_TOKEN,

  /**
   * Deadlocks
   */
  LOCK_MESSAGING_LOOPIDS: {},

  /**
   * Firebase related
   */
  fcmDatabaseURL: process.env.FIREBASE_DATABASE_URL,

  /**
   * API configs
   */
  api: {
    prefix: '/api',
    version: 'v1'
  },

  /**
   * The Graph Related
   */
  theGraphAPI: 'https://api.thegraph.com/subgraphs/name/',
  theGraphPollTime: 59,
  theGraphApis: process.env.THE_GRAPH_API_KEYS,
  /**
   * Sender Type for whoever sends the payload
   */
  senderType: {
    channel: 0,
    w2w: 1,
    pushVideo: 2,
    pushSpace: 3
  },
  /**
   * Newrelic key
   */
  NEWRELIC_LICENSE_KEY: process.env.NEWRELIC_LICENSE_KEY,
  chatVerifyingContract: '0x0000000000000000000000000000000000000000',
  /**
   * Notification setting type
   */
  notificationSettingType: {
    BOOLEAN_TYPE: 1,
    SLIDER_TYPE: 2,
    RANGE_TYPE: 3
  },
  infuraIpfsProjectId: process.env.INFURA_IPFS_PROJECT_ID,
  infuraIpfsProjectSecret: process.env.INFURA_IPFS_PROJECT_SECRET,
  /**
   * additional Meta config
   */
  additionalMeta: {
    // CUSTOM
    CUSTOM: {
      type: 0
    },
    // PUSH_VIDEO
    PUSH_VIDEO: {
      type: 1,
      version: [1],
      domain: ['push.org']
    },
    // PUSH_SPACE
    PUSH_SPACE: {
      type: 2,
      version: [1],
      domain: ['push.org']
    }
  },
  /**
   * internal soruces for notification
   */
  internalSupportedSourceTypes: ['PUSH_CHAT', 'PUSH_SPACES']
}
