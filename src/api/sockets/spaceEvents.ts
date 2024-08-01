import { Server } from 'socket.io'

import { SPACES, SPACES_MESSAGES, SPACES_ONLINE_STATUS } from './pushsocket'

export interface Result {
  success: boolean
  data?: any | null
  error?: string | null
  eventType?: string | null
}

export default class SpaceEvents {
  private _io: Server

  constructor(io: Server) {
    this._io = io
  }
  async sendMessageToReceipents(socketID: string, payload: any): Promise<void> {
    this._io.to(socketID).emit(SPACES_MESSAGES, payload)
  }

  async spaces(socketID: string, payload: any): Promise<void> {
    this._io.to(socketID).emit(SPACES, payload)
  }

  async spaceOnlineStatus(message: any): Promise<void> {
    this._io.sockets.emit(SPACES_ONLINE_STATUS, message)
  }
}
