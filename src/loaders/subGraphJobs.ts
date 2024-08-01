// Do Scheduling
// https://github.com/node-schedule/node-schedule
// *    *    *    *    *    *
// ┬    ┬    ┬    ┬    ┬    ┬
// │    │    │    │    │    │
// │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
// │    │    │    │    └───── month (1 - 12)
// │    │    │    └────────── day of month (1 - 31)
// │    │    └─────────────── hour (0 - 23)
// │    └──────────────────── minute (0 - 59)
// └───────────────────────── second (0 - 59, OPTIONAL)
// Execute a cron job every 5 Minutes = */5 * * * *
// Starts from seconds = * * * * * *

import schedule from 'node-schedule'
import { Container } from 'typedi'

import config from '../config'
import Channel from '../services/channelsCompositeClasses/channelsClass'
const gr = require('graphql-request')
const { request, gql } = gr
import epnsAPIHelper from '../helpers/epnsAPIHelper'
import PayloadsService from '../services/payloadsService'

//helper function to format the scheduler as per node-schedule
export function secondsToHms(pollTime) {
  const intervalInMinutes = Math.floor(pollTime / 60)
  const intervalInHours = Math.floor(intervalInMinutes / 60)
  const intervalInDays = Math.floor(intervalInHours / 24)

  if (intervalInDays > 0) {
    // if the interval is in days,
    return `0 0 */${intervalInDays} * * *`
  } else if (intervalInHours > 0) {
    // if the interval is in hours,
    return `0 0 */${intervalInHours} * * *`
  } else if (intervalInMinutes > 0) {
    // if the interval is in minutes,
    return `0 */${intervalInMinutes} * * * *`
  } else {
    // if the interval is in seconds,
    return `*/${pollTime} * * * * *`
  }
}

function formatPayload(rawPayloadData) {
  const data = {
    acta: rawPayloadData.cta,
    aimg: rawPayloadData.image,
    amsg: rawPayloadData.message,
    asub: rawPayloadData.subject,
    type: rawPayloadData.type
  }

  return {
    data: data,
    notification: {
      title: rawPayloadData.title,
      body: rawPayloadData.body
    }
  }
}

function interpretPayloadGraphId(payloadId: string) {
  if (payloadId && payloadId.split('+').length >= 2) {
    const latestId = payloadId.split('+')[1]
    return latestId
  } else return 0
}

// get allowed number of notifications
function getNotificationsCount(pollTimeInSeconds) {
  return Math.floor(pollTimeInSeconds / 20)
}

// fetch subgraph notifications and return allowed notifications
export async function fetchSubgraphNotifications(
  channel,
  pollTimeInSeconds,
  counter,
  subGraphId,
  logger
) {
  const payload = Container.get(PayloadsService)
  const channels = Container.get(Channel)
  const subgraphRetries = await channels.getSubgraphRetires(channel)
  if (subgraphRetries.result > config.subgraphMaxAttempts) return
  const latestPayloadId = counter
  logger.debug(
    `query url: ${subGraphId} & time interval:${pollTimeInSeconds} seconds from id ${latestPayloadId}`
  )
  const query1 = gql`{
        epnsPushNotifications(where:{
          notificationNumber_gt:${latestPayloadId}
        }, orderBy: notificationNumber, orderDirection: asc) {
          id
          notificationNumber
          recipient
          notification
        }
      }
      `

  const query2 = gql`{
    pushNotifications(where:{
      notificationNumber_gt:${latestPayloadId}
    }, orderBy: notificationNumber, orderDirection: asc) {
      id
      notificationNumber
      recipient
      notification
    }
  }
  `
  let response1 = []
  let response2 = []
  try {
    response1 = (await request(config.theGraphAPI + subGraphId, query1))['epnsPushNotifications']
  } catch (err) {
    try {
      response2 = (await request(config.theGraphAPI + subGraphId, query2))['pushNotifications']
    } catch (error) {
      console.log(error)
      if (subgraphRetries.status && subgraphRetries.result < config.subgraphMaxAttempts)
        await channels.updateSubgraphDetails(channel, 'subgraph_attempts', '')
      else {
        await schedule.cancelJob(channel)
      }
    }
  }

  const notifications = response1.concat(response2)
  const notificationsCount = await getNotificationsCount(pollTimeInSeconds)
  logger.info(`${notifications.length} Notifications Received`)
  //approve only the allowed number of notifications for each channel
  const approvedNotifications = notifications.slice(0, notificationsCount)
  logger.info(`${approvedNotifications.length} Notifications Approved`)
  return approvedNotifications
}

//helper function to schedule tasks
export async function scheduleTask(
  channel,
  pollTimeInSeconds,
  counter,
  cronTaskInterval,
  subGraphId,
  logger
) {
  logger.info(`Scheduling Task for ${channel}`)
  const payload = Container.get(PayloadsService)
  schedule.scheduleJob(channel, cronTaskInterval, async function () {
    try {
      if (counter == null || counter == 'NULL' || !Number.isInteger(counter)) counter = 0
      const notifications = await fetchSubgraphNotifications(
        channel,
        pollTimeInSeconds,
        counter,
        subGraphId,
        logger
      )
      logger.debug(`Scheduling Task for ${channel} Subgraph Notifications :${notifications} `)
      notifications.forEach(async (payloadData) => {
        //Increment counter
        counter = Math.max(counter, parseInt(payloadData.notificationNumber))
        const jasonifiedPayload = JSON.parse(payloadData.notification)
        const formattedPayload = formatPayload(jasonifiedPayload)
        try {
          await payload.addExternalPayload(
            `thegraph:${subGraphId}+${payloadData.notificationNumber}::uid::${Date.now().toString}`,
            channel,
            config.senderType.channel,
            'eip155:' + payloadData.recipient,
            'THE_GRAPH',
            `3+graph:${subGraphId}+${payloadData.notificationNumber}`
          )
        } catch (error) {
          logger.error(error)
        }
      })
      const channels = Container.get(Channel)
      await channels.updateSubgraphDetails(channel, 'counter', counter)
      logger.info(`🐣 Cron Task Completed-- ${channel}`)
    } catch (err) {
      logger.error(`❌ Cron Task Failed -- ${channel}`)
      logger.error(`Error Object: %o`, err.response)
    }
  })
}
//Main function
export default async function main({ logger }) {
  logger.info('Initiating subgraph cron tasks')
  const channel = Container.get(Channel)
  const jobs = await channel.getAllSubGraphDetails()
  if (jobs.result) {
    jobs.result.forEach((element) => {
      if (element.subgraph_attempts <= config.subgraphMaxAttempts) {
        const interprettedSubgraphDetails = epnsAPIHelper.interpretSubgraphIdentity(
          element.subgraph_details
        )
        scheduleTask(
          element.channel,
          interprettedSubgraphDetails.pollTime,
          element.counter,
          secondsToHms(interprettedSubgraphDetails.pollTime),
          interprettedSubgraphDetails.subgraphId,
          logger
        )
      }
    })
  }
}
