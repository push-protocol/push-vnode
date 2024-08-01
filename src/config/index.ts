import dotenv from 'dotenv'

// import {logLevel} from '../app'
// Set the NODE_ENV to 'development' by default
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// Optional support for CONFIG_DIR variable
console.log(`config dir is ${process.env.CONFIG_DIR}`)
let options = {}
if (process.env.CONFIG_DIR) {
  options = { path: `${process.env.CONFIG_DIR}/.env` }
}
const envFound = dotenv.config(options)
if (envFound.error) {
  // This error should crash whole process
  throw new Error("⚠️  Couldn't find .env file  ⚠️")
}
// End support for CONFIG_DIR variable

//get the general config
const generalConfig = require('./config-general').default

export const changeLogLevel = (level: string) => {
  if (level) {
    generalConfig.logs.level = level
  }
}
// load the appropriate config as per the server state
let config
let rateLimitConfig

if (process.env.PUSH_NODES_NET == 'PROD') {
  config = require('./config-prod').default
  rateLimitConfig = require('./ratelimit-config-prod')
} else if (process.env.PUSH_NODES_NET == 'STAGING') {
  config = require('./config-staging').default
  rateLimitConfig = require('./ratelimit-config-staging')
} else if (process.env.PUSH_NODES_NET == 'DEV') {
  config = require('./config-dev').default
  rateLimitConfig = require('./ratelimit-config-dev')
} else {
  throw new Error('⚠️  Provide proper PUSH_NODES_NET in .env ⚠️')
}

export default { ...config, ...generalConfig }
export { rateLimitConfig }
