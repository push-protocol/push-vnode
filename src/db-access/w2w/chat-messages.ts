import os from 'os'
import path from 'path'
import Container from 'typedi'

import * as db from '../../helpers/dbHelper'
import { readJsonFromFile } from '../../helpers/fileStorageHelper'
import { Message } from '../../interfaces/chat'
import ChatService from '../../services/chatService'

/**
 * adds a chat message to DB
 * @param messageData
 */
export async function createMessage({
  reference,
  chatId,
  cid,
  payload,
  timestamp
}: {
  reference: `v2:${string}`
  chatId: string
  cid: string
  payload: string
  timestamp: string
}): Promise<void> {
  return new Promise(async (resolve, reject) => {
    ;(db as any).query(
      `INSERT INTO chat_messages (reference, chat_id, cid, uploaded_to_ipfs, payload, timestamp) 
       VALUES (?, ?, ?, 0, ?, ?)`,
      [reference, chatId, cid, payload, timestamp],
      (err) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

/**
 * get message reference from threadhash
 * @param threadhash message threadhash ( ie `v2:SHA256_HASH` OR `previous:v2:SHA256_HASH` )
 */
export async function getReferenceFromThreadhash(threadhash: string): Promise<`v2:${string}`> {
  if (threadhash.startsWith('v2:')) {
    return threadhash as `v2:${string}`
  }
  if (threadhash.startsWith('previous:v2:')) {
    const nextReference = threadhash.replace('previous:', '') as `v2:${string}`
    const { uid, chat_id, timestamp } = await getReferenceMessageData(nextReference)
    return new Promise(async (resolve, reject) => {
      ;(db as any).query(
        'SELECT reference FROM chat_messages WHERE chat_id = ? AND timestamp <= ? AND uid < ? ORDER BY timestamp DESC LIMIT 1',
        [chat_id, timestamp, uid],
        (err: any, results: { reference: `v2:${string}` }[]) => {
          if (err) return reject(err)
          if (results.length === 0) return reject(new Error('Invalid threadhash'))
          return resolve(results[0].reference)
        }
      )
    })
  }

  try {
    // Legacy V1 Message
    const FILE_STORAGE_DIR: string = path.join(os.homedir(), 'chat')
    const message: Message = await readJsonFromFile(threadhash, FILE_STORAGE_DIR)
    const chatService = Container.get(ChatService)
    return chatService.createMessageReference(message) as `v2:${string}`
  } catch (e) {
    throw new Error('Invalid threadhash')
  }
}

/**
 * get message from DB
 * @param reference message reference `v2:SHA256_HASH`
 */
export async function getMessageByReference(reference: `v2:${string}`): Promise<Message> {
  return new Promise(async (resolve, reject) => {
    ;(db as any).query(
      'SELECT payload FROM chat_messages WHERE reference = ?',
      [reference],
      (err: any, results: { payload: string }[]) => {
        if (err || results.length === 0) return reject(err)
        const message = JSON.parse(results[0].payload)
        message.cid = reference
        return resolve(message)
      }
    )
  })
}

/**
 * get reference message data
 * @param reference message reference
 * @returns uid, timestamp and chat_id of the reference message
 */
async function getReferenceMessageData(
  reference: `v2:${string}`
): Promise<{ uid: number; timestamp: string; chat_id: string }> {
  return new Promise(async (resolve, reject) => {
    ;(db as any).query(
      'SELECT uid, timestamp, chat_id FROM chat_messages WHERE reference = ?',
      [reference],
      (err: any, results: { uid: number; timestamp: string; chat_id: string }[]) => {
        if (err || results.length === 0) return reject(err)
        return resolve(results[0])
      }
    )
  })
}

/**
 * get last `limit` messages from a reference message in a chat ie messages which were sent before the reference message ( including the reference message )
 * @param reference message reference
 * @param limit number of messages to fetch
 * @returns array of messages
 */
export async function getMessagesFromReference(
  reference: `v2:${string}`,
  limit: number
): Promise<Message[]> {
  // First, find the timestamp and chat_id of the reference message
  const { uid, timestamp, chat_id } = await getReferenceMessageData(reference)

  // Fetch the messages before the reference message ( including the reference message )
  const messages: { payload: string; reference: string }[] = await new Promise(
    (resolve, reject) => {
      ;(db as any).query(
        'SELECT reference, payload FROM chat_messages WHERE chat_id = ? AND uid <= ? AND timestamp <= ? ORDER BY timestamp DESC, uid DESC LIMIT ?',
        [chat_id, uid, timestamp, limit],
        (err: any, results: { payload: string; reference: string }[]) => {
          if (err) {
            reject(err)
          } else {
            resolve(results)
          }
        }
      )
    }
  )
  // Parse the messages and return them
  return messages.map((message) => {
    const msg = JSON.parse(message.payload)
    /**
     * @dev - Reference is added as cid for backward compatibility
     */
    msg.cid = message.reference
    return msg
  })
}

/**
 * get messages which are not uploaded to IPFS
 * @param limit number of messages to fetch
 */
export async function getMessagesNotUploadedToIPFS(limit: number): Promise<Message[]> {
  const messages: { payload: string; reference: string }[] = await new Promise(
    async (resolve, reject) => {
      ;(db as any).query(
        'SELECT payload FROM chat_messages WHERE uploaded_to_ipfs = 0 ORDER BY timestamp ASC LIMIT ?',
        [limit],
        (err: any, results: { payload: string; reference: string }[]) => {
          if (err) return reject(err)
          return resolve(results)
        }
      )
    }
  )
  // Parse the messages and return them
  return messages.map((message) => {
    const msg = JSON.parse(message.payload)
    msg.reference = message.reference
    return msg
  })
}

/**
 * mark message as uploaded to IPFS
 * @param reference message reference
 */
export async function markMessageAsUploaded(reference: `v2:${string}`): Promise<void> {
  return new Promise(async (resolve, reject) => {
    ;(db as any).query(
      'UPDATE chat_messages SET uploaded_to_ipfs = 1 WHERE reference = ?',
      [reference],
      (err) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

/**
 * Get messages data for a given chat_id
 * @param chatId chat_id of the chat
 */
export async function getMessagesDataForChatID(
  chatId: string,
  limit: number,
  offset: number
): Promise<{ reference: string; cid: string }[]> {
  return new Promise(async (resolve, reject) => {
    ;(db as any).query(
      'SELECT reference, cid FROM chat_messages WHERE chat_id = ? ORDER BY timestamp ASC limit ? offset ?',
      [chatId, limit, offset],
      (err: any, results: { reference: string; cid: string }[]) => {
        if (err) return reject(err)
        return resolve(results)
      }
    )
  })
}

/**
 * Delete all messages for a specific chat_id
 * @param chatId chat_id of the chat
 * @dev - Only used for removing messages for an expired chat
 */
export async function deleteMessagesForChatID(chatId: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    ;(db as any).query(
      'DELETE FROM chat_messages WHERE chat_id = ?',
      [chatId],
      (err: any, results: any) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}
