import Container from 'typedi'
import util from 'util'
import { Logger } from 'winston'

import * as db from '../../helpers/dbHelper'
export const migrateFeedsToNewIconFormat = async (): Promise<boolean> => {
  const logger: Logger = Container.get('logger')

  logger.debug('Starting migration of icons')
  // Migration Requirements
  const fetchChannelQuery = 'SELECT channel, alias_address, icon FROM channels'
  const iconObj = {}
  const dbQuery = util.promisify(db.query).bind(db)
  try {
    const results = await dbQuery(fetchChannelQuery, [])
    results.forEach((channelInfo) => {
      iconObj[channelInfo.channel.toLowerCase()] = channelInfo.icon
      if (channelInfo.alias_address) {
        iconObj[channelInfo.alias_address.toLowerCase()] = channelInfo.icon
      }
    })

    const size = 15000
    let offset = 0
    let flag = true

    while (flag) {
      logger.debug('Fetching records with size :: %o and offset :: %o', size, offset)
      const fetchFeedsQuery = `
          SELECT sid, sender, feed_payload
          FROM feeds
          ORDER BY sid
          LIMIT ${size} OFFSET ${offset}`
      const updateFeedsQuery = 'UPDATE feeds SET feed_payload = ? WHERE sid = ?;'

      const res = await dbQuery(fetchFeedsQuery, [])
      logger.debug('Feteched %o records from feeds', res.length)
      if (res.length === 0) {
        flag = false
        break
      } else {
        const updatePromises = res.map((feedData) => {
          if (typeof feedData.feed_payload === 'string') {
            feedData.feed_payload = JSON.parse(feedData.feed_payload)
          }
          if (
            feedData.feed_payload &&
            feedData.feed_payload.data &&
            iconObj[feedData.sender.toLowerCase()]
          ) {
            feedData.feed_payload.data.icon = iconObj[feedData.sender.toLowerCase()]
          }
          return dbQuery(updateFeedsQuery, [JSON.stringify(feedData.feed_payload), feedData.sid])
        })
        await Promise.all(updatePromises)
        offset += size
        logger.debug('Updated the icon to db cache in feeds')
      }
    }
    return true
  } catch (err) {
    return false
  }
}
