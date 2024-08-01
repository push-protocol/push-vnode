import loggerMiddleware from './loggerMiddleware'
import migrationInProgress from './migrationInProgress'
import notFoundMiddleware from './notFoundMiddleware'
import onlyAuthorized from './onlyAuthorized'
import onlyAuthorizedSimple from './onlyAuthorizedSimple'
import onlyLocalhost from './onlyLocalhost'
import onlyTrustedSource from './onlyTrustedSource'
import verifyAPIKey from './verifyAPIKey'
import verifyToken from './verifyToken'
// import customRedisRateLimiter from './apiRateLimiting';
export default {
  onlyTrustedSource,
  onlyLocalhost,
  onlyAuthorized,
  onlyAuthorizedSimple,
  verifyToken,
  verifyAPIKey,
  loggerMiddleware,
  notFoundMiddleware,
  migrationInProgress
  // customRedisRateLimiter,
}
