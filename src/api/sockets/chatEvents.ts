import { Server } from 'socket.io'
import { Container } from 'typedi'

import ChatService from '../../services/chatService'
import { postChatMessage, postChatRequest, putUpdateIntent } from '../validations'
import {
  CHAT_GROUPS,
  CHAT_RECEIVED_MESSAGE,
  CHAT_SEND_MESSAGE_ERROR,
  ONLINE_STATUS
} from './pushsocket'

export interface Result {
  success: boolean
  data?: any | null
  error?: string | null
  eventType?: string | null
}

export default class ChatEvents {
  private _io: Server
  private _chatService: ChatService

  constructor(io: Server) {
    this._io = io
    this._chatService = Container.get(ChatService)
  }

  async chatSendMessage(message: any): Promise<Result> {
    const { error } = postChatMessage.validate(message)
    if (error)
      return { success: false, error: 'Invalid Parameters', eventType: CHAT_SEND_MESSAGE_ERROR }
    return await this._chatService.createMessage(message)
  }

  async chatCreateIntent(message: any): Promise<Result> {
    const { error } = postChatRequest.validate(message)
    if (error)
      return { success: false, error: 'Invalid Parameters', eventType: CHAT_SEND_MESSAGE_ERROR }
    return await this._chatService.createIntent(message)
  }

  async chatUpdateIntent(message: any): Promise<Result> {
    const { error } = putUpdateIntent.validate(message)
    if (error)
      return { success: false, error: 'Invalid Parameters', eventType: CHAT_SEND_MESSAGE_ERROR }
    return await this._chatService.updateIntent(message)
  }

  async chatSendMessageToReceipents(socketID: string, payload: any): Promise<void> {
    this._io.to(socketID).emit(CHAT_RECEIVED_MESSAGE, payload)
  }

  async chatGroups(socketID: string, payload: any): Promise<void> {
    this._io.to(socketID).emit(CHAT_GROUPS, payload)
  }

  async chatOnlineStatus(message: any): Promise<void> {
    this._io.sockets.emit(ONLINE_STATUS, message)
  }
}
