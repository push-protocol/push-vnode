import { Server } from 'http'
import Container from 'typedi'

import { PushSocket } from '../api/sockets/pushsocket'
import config from '../config'

export default async ({ server }: { server: Server }) => {
  const socket = new PushSocket(server, config.socketMaxAllowedConnections as number)
  Container.set('pushSocket', socket)
}
