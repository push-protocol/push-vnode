import { Inject, Service } from 'typedi'

import { EventDispatcher, EventDispatcherInterface } from '../decorators/eventDispatcher'
import { TaggableTypes } from '../enums/TaggableTypes'
const db = require('../helpers/dbHelper')

@Service()
export default class TagsService {
  constructor(
    @Inject('logger') private logger,
    @EventDispatcher() private eventDispatcher: EventDispatcherInterface
  ) {}

  public async getTagsforResource(resourceId, resourceType) {
    const logger = this.logger

    return await new Promise((resolve, reject) => {
      const query = `
                SELECT t.tag_name
                FROM Tags t
                JOIN Taggables tg ON t.id = tg.tag_id
                WHERE tg.taggable_id = ? AND tg.taggable_type = ?
            `

      db.query(query, [resourceId, resourceType], function (error, results) {
        if (error) {
          reject(error)
        } else {
          logger.info('Tags for channel %s', results)
          resolve(results.map((tag) => tag.tag_name))
        }
      })
    })
  }

  public async getTaggableResources(page: number, limit: number, order: string, tags: any) {
    const logger = this.logger
    const offset = (page - 1) * limit

    return await new Promise((resolve, reject) => {
      const query = `
        SELECT c.*
        FROM Channels c
        JOIN Taggables tg ON c.channel = tg.taggable_id AND tg.taggable_type = '${TaggableTypes.Channel}'
        JOIN Tags t ON tg.tag_id = t.id
        WHERE t.tag_name IN (?)
        GROUP BY c.channel
        ORDER BY c.verified_status ${order}
        LIMIT ? OFFSET ?`

      // Step 2: Fetch all tags for these channels
      const queryTags = `
        SELECT c.channel, t.tag_name
        FROM Channels c
        JOIN Taggables tg ON c.channel = tg.taggable_id AND tg.taggable_type = '${TaggableTypes.Channel}'
        JOIN Tags t ON tg.tag_id = t.id
        WHERE c.channel IN (?)`

      const tagArray = typeof tags === 'string' ? JSON.parse(tags) : tags

      db.query(query, [tagArray, limit, offset], function (error, channels) {
        if (error) {
          reject(error)
        } else {
          const channelIds = channels.map((c) => c.channel)

          if (channelIds.length === 0) {
            resolve([])
            return
          }

          db.query(queryTags, [channelIds], function (error, channelTags) {
            if (error) {
              logger.error('Error fetching tags for channels:', error)
              reject(error)
            } else {
              // Aggregate tags for each channel
              const channelMap = new Map(channels.map((c) => [c.channel, { ...c, tags: [] }]))

              channelTags.forEach((t) => {
                if (channelMap.has(t.channel)) {
                  channelMap.get(t.channel).tags.push(t.tag_name)
                }
              })

              logger.info('Taggable resources retrieved successfully:', channelMap)
              resolve(Array.from(channelMap.values()))
            }
          })
        }
      })
    })
  }
}
