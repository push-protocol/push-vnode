import { Inject, Service } from 'typedi'

import * as db from '../../helpers/dbHelper'

@Service()
export default class NPIPPayloadMigration {
  constructor(@Inject('logger') private logger) {}

  public async npipPayloadMigration() {
    const logger = this.logger
    logger.debug('NPIPPayloadMigration Started')
    const limit = 5000
    let offset = 0
    const selectQuery =
      'SELECT sid, users, prepared_payload, channel from feeds ORDER BY epoch DESC LIMIT ? OFFSET ?'
    let moreResults = true
    let count = 0
    while (moreResults) {
      await new Promise(async (resolve, reject) => {
        logger.debug('Fetching records with limit :: %o and offset :: %o', limit, offset)
        await (db as any).query(selectQuery, [limit, offset], function (err, results) {
          if (err) {
            return reject(err)
          } else {
            return resolve(results)
          }
        })
      })
        .then(async (response: any) => {
          logger.debug('Number of records fetched :: %o ', response.length)
          if (response.length == 0) {
            moreResults = false
          }
          for (let i = 0; i < response.length; i++) {
            count = count + 1
            const item = response[i]
            try {
              const npip_prepared_payload = await this.constructNPIPPayload(
                JSON.parse(item.users),
                JSON.parse(item.prepared_payload),
                item.channel
              )
              const updateQuery = 'UPDATE feeds set prepared_payload=? WHERE sid=?'
              await new Promise(async (resolve, reject) => {
                await (db as any).query(
                  updateQuery,
                  [JSON.stringify(npip_prepared_payload), item.sid],
                  function (err, results) {
                    if (err) {
                      return reject(err)
                    } else {
                      return resolve(results)
                    }
                  }
                )
              })
                .then(async (response) => {
                  logger.debug('Updated the record for sid :: %o', item.sid)
                })
                .catch((err) => {
                  logger.error(
                    'Error while Updating the record for sid :: %o Error :: %o',
                    item.sid,
                    err
                  )
                })
            } catch (err) {
              logger.error(err)
              logger.error('Error in constructNPIPPayload() for sid: ' + item.sid)
            }
          }
        })
        .catch((err) => {
          logger.error(err)
          throw err
        })
      offset = offset + limit
    }
    logger.debug('NPIPPayloadMigration Finished. Total records processed :: ' + count)
    return {
      success: 1
    }
  }

  public async constructNPIPPayload(users: any, prepared_payload: any, channel: string) {
    delete prepared_payload['data']['secret']
    delete prepared_payload['data']['appbot']
    prepared_payload['data']['sectype'] = null
    prepared_payload['data']['etime'] = null
    const notificationType = prepared_payload['data']['type']
    if (notificationType == 1) {
      prepared_payload['receipients'] = channel.toLowerCase()
    } else {
      const receipients = {}
      for (let i = 0; i < users.length; i++) {
        receipients[users[i].toLowerCase()] = null
      }
      prepared_payload['receipients'] = receipients
    }

    return prepared_payload
  }
}
