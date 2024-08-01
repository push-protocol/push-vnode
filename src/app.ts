import { startServer } from './appInit'
import { EnvLoader } from './utilz/envLoader'

// Call server from here to ensure test cases run fine
if (EnvLoader.getPropertyAsBool('VALIDATOR_DISABLE_HISTORY_SYNC')) {
  startServer('debug', true).catch((err) => {
    console.log('error while starting ' + err);
    console.error(err);
    process.exit(1)
  })
} else {
  const p = startServer().catch((err) => {
    console.log('error while starting_' + err);
    console.error(err);
    process.exit(1)
  })
}

// stopServer shuts down the server. Used in tests.
async function stopServer() {
  process.exit(0)
}

export { startServer, stopServer }
