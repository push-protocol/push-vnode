import moment from 'moment'

import config from '../../config'
import { rateLimitConfig } from '../../config'
import { client } from '../../loaders/redis'

const createNewRecord = async (user, api: string, timestamp) => {
  const newRecord = []
  // Store the timestamp and number of requests made
  const requestLog = {
    requestTimeStamp: timestamp.unix(),
    requestCount: 1
  }
  newRecord.push(requestLog)

  const obj = {}
  obj[api] = newRecord
  // Store it in redis
  await client.set(user, JSON.stringify(obj))
}

const getUserRequestCount = (record, routeRateLimitConfig) => {
  const windowStartTimestamp = moment()
    .subtract(routeRateLimitConfig['WINDOW_SIZE_IN_SECONDS'], 'seconds')
    .unix()
  const requestsWithinWindow = record.filter((entry) => {
    return entry.requestTimeStamp > windowStartTimestamp
  })
  // console.log('requestsWithinWindow', requestsWithinWindow);
  const totalWindowRequestsCount = requestsWithinWindow.reduce((accumulator, entry) => {
    return accumulator + entry.requestCount
  }, 0)
  return totalWindowRequestsCount
}

const updateRequestCount = async (user, record, api, timestamp, routeRateLimitConfig) => {
  const lastRequestLog = record[api][record[api].length - 1]
  const potentialCurrentWindowIntervalStartTimeStamp = timestamp
    .subtract(routeRateLimitConfig['WINDOW_LOG_INTERVAL_IN_SECONDS'], 'seconds')
    .unix()
  //  if interval has not passed since last request log, increment counter
  if (lastRequestLog.requestTimeStamp > potentialCurrentWindowIntervalStartTimeStamp) {
    lastRequestLog.requestCount++
    record[api][record.length - 1] = lastRequestLog
  } else {
    //  if interval has passed, log new entry for current user and timestamp
    record[api].push({
      requestTimeStamp: timestamp.unix(),
      requestCount: 1
    })
  }
  await client.set(user, JSON.stringify(record))
}

const keyBasedAPIRateLimitingMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    const accessToken = authHeader && authHeader.split(' ')[1]
    if (
      config.trustedIPs.includes(req.ip) ||
      config.trusterURLs.includes(req.headers.host) ||
      (accessToken !== undefined && config.trustedAccessToken === accessToken)
    ) {
      return next()
    }
    const api = req.method + '::' + req.path
    let routeRateLimitConfig = null
    for (const [key, value] of Object.entries(rateLimitConfig)) {
      if (api.match(key)) {
        routeRateLimitConfig = value
        break
      }
    }

    if (routeRateLimitConfig == null) {
      // We have commented this log below because for routes that didn't have rate limit configure we were getting
      // the logs duplicated
      // console.log(' unable to find rate limit config for api going for the default config :: ' + api )
      routeRateLimitConfig = rateLimitConfig['default']
    }
    // fetch all the record of request

    if (req.headers['authorization'] == null) {
      return next()
    }

    if (req.headers['authorization'].split(' ').len != 2) {
      return next()
    }

    const key = req.headers['authorization'].split(' ')[1]

    const record = await client.get(key)
    const currentRequestTime = moment()
    // if returns null, fresh user so create the record
    if (record == null || JSON.parse(record)[api] == null) {
      createNewRecord(key, api, currentRequestTime)
    } else {
      // record found, now check for request count and accordingly either process or discard the request
      const data = JSON.parse(record)
      const requestCount = getUserRequestCount(data[api], routeRateLimitConfig)
      // If the request count exceeds the limit or the key doesnt belong to trusted ip, return error
      if (requestCount >= routeRateLimitConfig['MAX_WINDOW_REQUEST_COUNT']) {
        // const error = `You have exceeded the ${MAX_WINDOW_REQUEST_COUNT} requests in ${WINDOW_SIZE_IN_SECONDS} seconds limit!`;
        return res.status(429).json({
          error: `You have exceeded the ${routeRateLimitConfig['MAX_WINDOW_REQUEST_COUNT']} requests in ${routeRateLimitConfig['WINDOW_SIZE_IN_SECONDS']} seconds limit!`
        })
        // return next(error);
      }
      // or else update the count
      else {
        await updateRequestCount(key, data, api, currentRequestTime, routeRateLimitConfig)
      }
    }
    return next()
  } catch (error) {
    console.log(error)
    return next(error)
  }
}

export default keyBasedAPIRateLimitingMiddleware
