import { createClient } from 'redis'

import config from '../config'
import logger from '../loaders/logger'

let client: ReturnType<typeof createClient>

export default async () => {
  client = await createClient({
    url: config.REDIS_URL
  })
  await client.connect()
  client.on('error', (err) => logger.error('Redis Client Error', err))
  await client.set('connection', 'Redis connection successful')
}

export { client }
