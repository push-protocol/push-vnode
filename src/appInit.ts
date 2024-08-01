import 'reflect-metadata' // We need this in order to use @Decorators
import 'newrelic'

import chalk from 'chalk'
import express from 'express'
import { createServer, Server } from 'http'

import loaders from './loaders'
import { initValidator } from './services/messaging/validatorLoader'

let server: Server

async function startServer(logLevel: string = null, testMode = false, padder = 0) {
  if (logLevel) {
    const changeLogLevel = (await require('./config/index')).changeLogLevel
    changeLogLevel(logLevel)
  }

  // Continue Loading normally
  const config = require('./config/index').default
  logLevel = logLevel || config.logs.level

  // ONLY TIME CONSOLE IS USED
  if (!testMode) {
    console.log(
      ' '.repeat(padder),
      chalk.bold.inverse(` RUNNING WITH LOG LEVEL `),
      chalk.bold.blue.inverse(`  ${logLevel}  `),
      chalk.bold.green.inverse(`  ${config.pushNodesNet}  `)
    )
  }

  // Load logger
  const Logger = (await require('./loaders/logger')).default

  // CHECK IF THE ENVIROMENT LOADED IS RIGHT
  if (
    config.pushNodesNet !== 'PROD' &&
    config.pushNodesNet !== 'STAGING' &&
    config.pushNodesNet !== 'DEV'
  ) {
    Logger.error(
      "Can't continue, PUSH_NODES_NET needs to be set in .env to either PROD, STAGING or DEV"
    )
    process.exit(1)
  }

  //Check Node Version
  Logger.info('Checking Node Version')
  const nodeVersionChecker = (await require('./loaders/checkNodeVersion')).default
  await nodeVersionChecker()
  Logger.info('Node Version >= Minimum Required Version')

  if (!process.env.CONFIG_DIR) {
    // Check environment setup first
    Logger.info('Verifying ENV')
    const EnvVerifierLoader = (await require('./loaders/envVerifier')).default
    await EnvVerifierLoader()
    Logger.info('ENV Verified / Generated and Loaded!')
  }

  const app = express()
  server = createServer(app)

  await loaders({
    expressApp: app,
    server: server,
    testMode: testMode
  })

  await initValidator()

  server.listen(config.port, (err) => {
    if (err) {
      Logger.error(err)
      process.exit(1)
    }

    let artwork = `
      ██████╗ ██╗   ██╗███████╗██╗  ██╗    ███╗   ██╗ ██████╗ ██████╗ ███████╗
      ██╔══██╗██║   ██║██╔════╝██║  ██║    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝
      ██████╔╝██║   ██║███████╗███████║    ██╔██╗ ██║██║   ██║██║  ██║█████╗  
      ██╔═══╝ ██║   ██║╚════██║██╔══██║    ██║╚██╗██║██║   ██║██║  ██║██╔══╝  
      ██║     ╚██████╔╝███████║██║  ██║    ██║ ╚████║╚██████╔╝██████╔╝███████╗
      ╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝                                                                          
    `

    if (config.pushNodesNet === 'STAGING') {
      artwork = `
        ██████╗ ██╗   ██╗███████╗██╗  ██╗    ███╗   ██╗ ██████╗ ██████╗ ███████╗    ███████╗████████╗ █████╗  ██████╗ ██╗███╗   ██╗ ██████╗ 
        ██╔══██╗██║   ██║██╔════╝██║  ██║    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝ ██║████╗  ██║██╔════╝ 
        ██████╔╝██║   ██║███████╗███████║    ██╔██╗ ██║██║   ██║██║  ██║█████╗      ███████╗   ██║   ███████║██║  ███╗██║██╔██╗ ██║██║  ███╗
        ██╔═══╝ ██║   ██║╚════██║██╔══██║    ██║╚██╗██║██║   ██║██║  ██║██╔══╝      ╚════██║   ██║   ██╔══██║██║   ██║██║██║╚██╗██║██║   ██║
        ██║     ╚██████╔╝███████║██║  ██║    ██║ ╚████║╚██████╔╝██████╔╝███████╗    ███████║   ██║   ██║  ██║╚██████╔╝██║██║ ╚████║╚██████╔╝
        ╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝                                                                     
      `
    }

    if (config.pushNodesNet === 'DEV') {
      artwork = `
        ██████╗ ██╗   ██╗███████╗██╗  ██╗    ███╗   ██╗ ██████╗ ██████╗ ███████╗    ██████╗ ███████╗██╗   ██╗
        ██╔══██╗██║   ██║██╔════╝██║  ██║    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝    ██╔══██╗██╔════╝██║   ██║
        ██████╔╝██║   ██║███████╗███████║    ██╔██╗ ██║██║   ██║██║  ██║█████╗      ██║  ██║█████╗  ██║   ██║
        ██╔═══╝ ██║   ██║╚════██║██╔══██║    ██║╚██╗██║██║   ██║██║  ██║██╔══╝      ██║  ██║██╔══╝  ╚██╗ ██╔╝
        ██║     ╚██████╔╝███████║██║  ██║    ██║ ╚████║╚██████╔╝██████╔╝███████╗    ██████╔╝███████╗ ╚████╔╝ 
        ╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚═════╝ ╚══════╝  ╚═══╝                                                                
      `
    }

    Logger.info(`
      ################################################

      

      ${artwork}



      🛡️  Server listening on port: ${config.port} 🛡️

      ################################################
    `)
  })
}

// stopServer shuts down the server. Used in tests.
async function stopServer() {
  //process.exit(0);
  server.close()
}

export { startServer, stopServer }
