import { Container } from 'typedi'

import DynamicLoggerInstance from './dynamicLogger'
import IPFS from './ipfs'
import LoggerInstance from './logger'

export default ({ testMode }) => {
  try {
    Container.set('dynamicLogger', DynamicLoggerInstance)
    DynamicLoggerInstance.setDisabled(testMode)
    LoggerInstance.info('Dynamic Logger Injected')

    Container.set('logger', LoggerInstance)
    LoggerInstance.info('Winston Logger Injected')

    Container.set('ipfs', IPFS)
    LoggerInstance.info('IPFS Injected')
  } catch (e) {
    LoggerInstance.error('Error on dependency injector loader: %o', e)
    throw e
  }
}
