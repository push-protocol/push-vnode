import { Inject, Service } from 'typedi'

import { EventDispatcher, EventDispatcherInterface } from '../decorators/eventDispatcher'

const db = require('../helpers/dbHelper')

@Service()
export default class UsersService {
  constructor(
    @Inject('logger') private logger,
    @EventDispatcher() private eventDispatcher: EventDispatcherInterface
  ) {}

  // Get channel list to which a user is subscriber to or not subscribed
  public async getSubscribedChannels(userAddress) {
    const logger = this.logger
    return await new Promise((resolve, reject) => {
      //To get the channels user is subscribed to
      const query = `SELECT channel, user_settings FROM subscribers where subscriber='${userAddress}' AND is_currently_subscribed=1;`

      db.query(query, [], function (error, results) {
        if (error) {
          reject({
            error: error
          })
        } else {
          logger.info('Get subscribeed channels List %s', results)
          resolve({
            subscriptions: results
          })
        }
      })
    })
  }

  // Get list of all channels delegated to a user
  public async getDelegatedChannels(userAddress) {
    const logger = this.logger
    return await new Promise((resolve, reject) => {
      //To get the channels user is subscribed to
      const query = `SELECT channel FROM delegates WHERE delegate='${userAddress}'`

      db.query(query, [], function (error, results) {
        if (error) {
          reject({
            error: error
          })
        } else {
          logger.debug('Get delegated channels list: %s', results)
          logger.debug('Completed getDelegatedChannels()')

          resolve({
            delegations: results
          })
        }
      })
    })
  }
}
