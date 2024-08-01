import { Container, Inject, Service } from 'typedi'

import { EventDispatcher, EventDispatcherInterface } from '../decorators/eventDispatcher'
import Channel from './channelsCompositeClasses/channelsClass'
const axios = require('axios').default

@Service()
export default class ChannelsService {
  constructor(
    @Inject('logger') private logger,
    @EventDispatcher() private eventDispatcher: EventDispatcherInterface
  ) {}

  public async _createDeleteChannel() {
    return await new Promise(async (resolve) => {
      const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
      const channelType = 2
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'

      const channelClass = Container.get(Channel)
      await channelClass._deleteChannel(channel, identity)
      const CHANNEL_BASE_URL = 'http://[::1]:4000/apis/channels'

      try {
        const response = await axios.post(CHANNEL_BASE_URL + '/add', {
          channel: channel,
          channelType: channelType,
          identity: identity
        })
      } catch (err) {
        console.error('🔥  error in create channel test: %s', err)
      } finally {
        await channelClass._deleteChannel(channel, identity)
        resolve({ success: 1 })
      }
    })
  }
}
