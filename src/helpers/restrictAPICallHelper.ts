import { Container } from 'typedi'
import { Logger } from 'winston'

export function restrictAPICall(restrictedFlow: string, afterFlowFilter: string): boolean {
  // only allow api calls to come if it comes from restricted flow, reject if not.
  // for example, passing 'src/tests/' would mean the function should
  // have originated from src/test to be valid, once src/tests folder is found,
  // afterFlowFilter ensures if any call is coming after from that folder then it's rejected,
  // for example, it will mostly be /src/
  const logger: Logger = Container.get('logger')

  let reject = true
  let restrictedFlowFound = false
  let afterFlowFilterFound = false

  const errorTrace = new Error().stack
  const functionsTrace = errorTrace.split('\n')

  for (const funcCalls of functionsTrace) {
    if (!restrictedFlowFound) {
      if (funcCalls.indexOf(restrictedFlow) !== -1) {
        restrictedFlowFound = true
      }
    } else {
      // restrictedFlow found, check afterFlow afterFlowFilter
      if (funcCalls.indexOf(afterFlowFilter) !== -1) {
        afterFlowFilterFound = true
      }
    }
  }

  if (restrictedFlowFound && !afterFlowFilterFound) {
    reject = false
  }

  if (reject) {
    logger.error(
      'Restricted API Call with restrictedFlow: %s and afterFlowBlacklist: %s',
      restrictedFlow,
      afterFlowFilter
    )
    logger.error('Stack Trace %o', functionsTrace)
    throw errorTrace
  } else {
    return true
  }
}
