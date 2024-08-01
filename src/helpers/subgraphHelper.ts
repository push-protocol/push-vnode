import { gql, request } from 'graphql-request'

import config from '../config'

//  Get the latest counter when subgraph is attached
export const getSubgraphCounter = async (subGraphId) => {
  const query = gql`
    {
      epnsPushNotifications(first: 1, orderBy: notificationNumber, orderDirection: desc) {
        notificationNumber
      }
    }
  `
  try {
    const response = await request(config.theGraphAPI + subGraphId, query)
    return parseInt(response['epnsPushNotifications'][0]['notificationNumber'])
  } catch (err) {
    return 0
  }
}
