import pkg from '../../../appInit.ts'
const { startServer } = pkg

import { Container, Servcie, Inject } from 'typedi'

import PayloadsService from '../../../services/payloadsService'
import ChannelsService from '../../../services/channelsService'

// It all starts here
export default async (func) => {
  console.log(func)

  // Start server but minimal mode, ie: devtools
  await startServer(null, false, false)

  console.log('done')
  const Logger = Container.get('logger')
  Logger.debug('Hello')

  try {
    const channels = Container.get(ChannelsService)
    console.log(channels)

    const { success, channel, ipfshash } = await channels.sayHello()
  } catch (err) {
    console.log(err)
  }

  Logger.debug('Hello1')

  console.log(channel)
  Logger.debug('Hello2')

  try {
    const channels = Container.get(Channel)
    const { success, channel, ipfshash } = await channels.batchProcessChannelData()
    return res.status(201).json({ success, channel, ipfshash })
  } catch (e) {
    Logger.error('🔥 error: %o', e)
  }
}
