import { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../../config'
import {
  convertCaipToAddress,
  isValidCAIP10Address as isValidCAIP10,
  isValidPartialCAIP10Address
} from '../../helpers/caipHelper'
import {
  isValidCAIP10Address,
  isValidNFTAddress,
  isValidNFTAddressV2,
  isValidSCWAddress
} from '../../helpers/chatHelper'
import { client as redisClient } from '../../loaders/redis'
import ChatEvents from './chatEvents'
import FeedEvents from './feedEvents'
import SpaceEvents from './spaceEvents'
import TargetEvents from './targetEvents'

const CHAT_SEND_MESSAGE = 'CHAT_SEND'
const CHAT_CREATE_INTENT = 'CREATE_INTENT'
export const CHAT_UPDATE_INTENT = 'UPDATE_INTENT'
export const CHAT_SEND_MESSAGE_ERROR = 'CHAT_ERROR'
export const CHAT_RECEIVED_MESSAGE = 'CHATS'
export const REDIS_KEY_PREFIX_DID = 'chat_did_'
export const REDIS_KEY_PREFIX_SOCKET_ID = 'chat_socket_'
const HISTORICAL_FEED_EVENT = 'historicalFeeds'
const ONLINE_USERS = 'ONLINE_USERS'
export const ONLINE_STATUS = 'ONLINE_STATUS'
export const CHAT_GROUPS = 'CHAT_GROUPS'
export const SPACES = 'SPACES'
export const SPACES_MESSAGES = 'SPACES_MESSAGES'
export const SPACES_ONLINE_STATUS = 'SPACES_ONLINE_STATUS'

const MAX_ALLOWED_CONNECTION: number = config.socketMaxAllowedConnections
let targetEvent: TargetEvents
let clients: { address: string; socket: any }[] = []
const clientAddress = new Map() //for storing no. of connections
let chatClients: { did: string; socket: any }[] = []
const chatClientAddress = new Map()
let deliveryNodes = []
let feedEvent = null

enum SocketMode {
  Chat = 'chat',
  Delivery = 'delivery',
  MESSAGE_BLOCK = 'MESSAGE_BLOCK'
}

export class PushSocket {
  public chatEvent: ChatEvents
  public spaceEvent: SpaceEvents

  public maxAllowedConnection: number

  private static _hasInstance: boolean = false // Flag to indicate if this class has already been instanciated

  constructor(server: HttpServer, maxAllowedConnection: number) {
    this.maxAllowedConnection = maxAllowedConnection
    if (PushSocket._hasInstance) {
      throw Error('Socket instance already created')
    }

    PushSocket._hasInstance = true
    this._connect(server)
  }

  private async _connect(server: HttpServer): Promise<void> {
    const io = new Server(server)
    targetEvent = Container.get(TargetEvents)
    targetEvent.io = io
    targetEvent.page = 1
    targetEvent.pageNumber = 10000
    this.chatEvent = new ChatEvents(io)
    this.spaceEvent = new SpaceEvents(io)
    feedEvent = Container.get(FeedEvents)
    feedEvent.io = io

    io.on('connection', async (socket) => {
      const logger: Logger = Container.get('logger')
      logger.info(`New socket connection - ID : ${socket.id} `)

      // This is a temp change until we decide the handshake mechanism
      const handshakeQuery: string | string[] = socket.handshake.query['mode']
      if (
        (!handshakeQuery || Array.isArray(handshakeQuery)) &&
        !socket.handshake.query['address']
      ) {
        socket.disconnect()
        return
      }

      const mode = handshakeQuery

      if (mode === SocketMode.Chat) {
        const did: string | string[] = socket.handshake.query['did']
        if (!did || Array.isArray(did)) {
          logger.error('Disconnecting the socket due to no did sent in the query')
          socket.disconnect()
          return
        }
        if (
          !isValidCAIP10Address(did) &&
          !isValidNFTAddressV2(did) &&
          !isValidNFTAddress(did) &&
          !isValidSCWAddress(did)
        ) {
          logger.info('Invalid did')
          socket.disconnect()
          return
        }
        const chatConnectionNum = chatClientAddress[did] || 0
        if (chatConnectionNum > MAX_ALLOWED_CONNECTION) {
          logger.error('Disconnecting the socket: Max Connections Reached !!!')
          socket.disconnect()
          return
        } else {
          chatClientAddress[did] = chatConnectionNum + 1
          chatClients.push({ did: did, socket: socket })
        }

        const userKey = REDIS_KEY_PREFIX_DID + did
        const redisResult: string = await redisClient.get(userKey)
        let record: string[]

        if (!redisResult) {
          record = []
        } else {
          record = JSON.parse(redisResult)
        }
        record.push(socket.id)

        await redisClient.set(userKey, JSON.stringify(record))
        await redisClient.expire(userKey, 3600 * 12) //expire in 12h

        await redisClient.set(REDIS_KEY_PREFIX_SOCKET_ID + socket.id, did)
        await redisClient.expire(REDIS_KEY_PREFIX_SOCKET_ID + socket.id, 3600 * 12) //expire in 12h

        // update online
        const onlineUsers: string = await redisClient.get(ONLINE_USERS)
        // set to make sure no duplicate entries
        let newOnlineMembers: any | Set<string>
        if (!onlineUsers) {
          // create a new set
          newOnlineMembers = new Set()
        } else {
          newOnlineMembers = new Set(onlineUsers.split(','))
        }
        if (!newOnlineMembers.has(did)) {
          newOnlineMembers.add(did)
          await redisClient.set(ONLINE_USERS, [...newOnlineMembers].join(','))
        }
        await this.chatEvent.chatOnlineStatus([...newOnlineMembers])
        await this.spaceEvent.spaceOnlineStatus([...newOnlineMembers])
      } else if (mode === SocketMode.Delivery) {
        deliveryNodes.push({
          socket: socket
        })
      } else if (mode === SocketMode.MESSAGE_BLOCK) {
        // todo perform some sig-based auth
        deliveryNodes.push({
          socket: socket
        })
      }
      // This is the existing socket handling
      else {
        const socketAddress = socket.handshake.query['address']
        if (
          !socketAddress ||
          Array.isArray(socketAddress) ||
          !(
            isValidCAIP10(socketAddress) ||
            isValidPartialCAIP10Address(socketAddress) ||
            isValidNFTAddressV2(socketAddress) ||
            isValidNFTAddress(socketAddress) ||
            isValidSCWAddress(socketAddress)
          )
        ) {
          logger.error(
            'Disconnecting the socket due to no or invalid address sent in the query' +
              ' socket id :: ' +
              socketAddress
          )
          socket.disconnect()
          return
        }
        const address =
          isValidNFTAddressV2(socketAddress) ||
          isValidNFTAddress(socketAddress) ||
          isValidSCWAddress(socketAddress)
            ? socketAddress
            : 'eip155:' + convertCaipToAddress(socketAddress).result.toLowerCase()
        const connectionNum = clientAddress[address] || 0
        if (connectionNum >= MAX_ALLOWED_CONNECTION) {
          logger.error('Disconnecting the socket: Max Connections Reached !!!')
          socket.disconnect()
          return
        } else {
          clientAddress[address] = connectionNum + 1
          clients.push({ address: address, socket: socket })
          targetEvent.sendTragetedFeeds(address, socket.id)
          targetEvent.sendTargetedSpam(address, socket.id)
        }

        logger.info(`Address : ${address}`)
      }
      // We had to add this because inside the 'disconnect' logic when doing this.chatEvent.chatOnlineStatus() it was giving that the chatEvent was undefined
      const self = this
      socket.on('disconnect', async function () {
        logger.info(`Socket Connection Dropped - ID : ${socket.id}`)

        if (mode === SocketMode.Chat) {
          const socketKey = REDIS_KEY_PREFIX_SOCKET_ID + socket.id
          const did = await redisClient.get(socketKey)
          if (did) {
            // remove the docket id that was diconnected
            chatClients = chatClients.filter((each) => {
              if (each.socket.id !== socket.id) return true
              return false
            })
            // reduce the number of connections for that did
            chatClientAddress[did] = chatClientAddress[did] - 1
            const userKey = REDIS_KEY_PREFIX_DID + did
            const redisResult: string = await redisClient.get(userKey)
            if (redisResult) {
              // We delete from redis the closing socket and
              // we update the mapping between did -> socket to remove the closing socket
              let record: string[]
              record = JSON.parse(redisResult)
              record = record.filter((socketId) => {
                return socketId !== socket.id
              })
              await redisClient.set(userKey, JSON.stringify(record))
            }
            await redisClient.del(socketKey)
            //get the current list of onliine users
            const onlineUsers: string = await redisClient.get(ONLINE_USERS)
            // if there is any
            if (onlineUsers && chatClientAddress[did] == 0) {
              // form a ste
              const onlineUserArray: Set<string> = new Set(onlineUsers.split(','))
              // delete the entry that went offline
              onlineUserArray.delete(did)
              // update the online user list
              await redisClient.set(ONLINE_USERS, [...onlineUserArray].join(','))
              await self.chatEvent.chatOnlineStatus([...onlineUserArray])
              await self.spaceEvent.spaceOnlineStatus([...onlineUserArray])
            }
          }
        }
        if (mode === SocketMode.Delivery) {
          logger.info('Delivery node disconnected')
          deliveryNodes = deliveryNodes.filter((each) => {
            return each.socket.id !== socket.id
          })
        } else {
          //remove the client on disconnect
          let address: string
          clients = clients.filter((each) => {
            if (each.socket.id !== socket.id) return true
            address = each.address
            return false
          })
          clientAddress[address] = clientAddress[address] - 1
        }
      })

      socket.on(CHAT_SEND_MESSAGE, async (message, callback) => {
        try {
          const result = await this.chatEvent.chatSendMessage(message)
          callback(result)
        } catch (err) {
          logger.error(err)
        }
      })

      socket.on(CHAT_CREATE_INTENT, async (message, callback) => {
        try {
          const result = await this.chatEvent.chatCreateIntent(message)
          callback(result)
        } catch (err) {
          logger.error(err)
        }
      })

      socket.on(CHAT_UPDATE_INTENT, async (message, callback) => {
        try {
          const result = await this.chatEvent.chatUpdateIntent(message)
          callback(result)
        } catch (err) {
          logger.error(err)
        }
      })

      socket.on(ONLINE_STATUS, async () => {
        try {
          const onlineUsers: string = await redisClient.get(ONLINE_USERS)
          await this.chatEvent.chatOnlineStatus(onlineUsers)
          await this.spaceEvent.spaceOnlineStatus(onlineUsers)
        } catch (err) {
          logger.error(err)
        }
      })

      socket.on(HISTORICAL_FEED_EVENT, (request) => {
        if (request == null) {
          logger.error('!!!! Invalid request sent from the delivery node hence skipping !!!!')
          return
        }
        logger.info(
          'Received request to fetch feeds fetcher with request body :: %o. Socket connection - ID :: %o',
          JSON.stringify(request),
          socket.id
        )

        if (
          !request['startTime'] ||
          !request['endTime'] ||
          !request['page'] ||
          !request['pageSize']
        ) {
          logger.info(
            'Invalid request parameters to fetch historicalFeeds. Hence ignoring the request from socket :: %o',
            socket.id
          )
        } else if (
          isNaN(request['startTime']) ||
          isNaN(request['endTime']) ||
          isNaN(request['page']) ||
          isNaN(request['pageSize'])
        ) {
          logger.info(
            'Invalid request parameters to fetch historicalFeeds. Hence ignoring the request from socket :: %o',
            socket.id
          )
        } else {
          logger.info(
            'Validated feeds request parameters. Sending feeds between :: %o and %o ',
            new Date(Number(request['startTime'])),
            new Date(Number(request['endTime']))
          )
          feedEvent.sendHistoricalFeeds(
            socket.id,
            request['startTime'],
            request['endTime'],
            request['page'],
            request['pageSize']
          )
        }
      })
    })
  }

  static getDeliveryNodes() {
    return deliveryNodes
  }
  static getTargetEvent(): TargetEvents {
    return targetEvent
  }

  static getFeedEvent() {
    return feedEvent
  }

  static getClients() {
    return clients
  }
}
