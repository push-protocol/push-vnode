import os from 'os'
import path from 'path'
import { Container } from 'typedi'
import { Logger } from 'winston'

import * as w2wRepository from '../../db-access/w2w'
import * as db from '../../helpers/dbHelper'
import { readJsonFromFile, writeJsonToFile } from '../../helpers/fileStorageHelper'
import { Message } from '../../interfaces/chat'
import ChatService from '../../services/chatService'
import { changeMigrationStatus, getMigrationStatus } from '.'

/**
 * MESSAGEV2 MIGRATION
 */

const FILE_STORAGE_DIR: string = path.join(os.homedir(), 'chat')

const getMessage = async (cid: string): Promise<Message> => {
  try {
    const message = await readJsonFromFile(cid, FILE_STORAGE_DIR)
    if (!message) {
      const message = await w2wRepository.getMessageFromIPFS(cid)
      await writeJsonToFile(message, cid, FILE_STORAGE_DIR)
    }
    return message
  } catch (err) {
    return null
  }
}

const llParser = async (
  threadhash: string | null,
  chatId: string,
  fallBackEpoch: number,
  logger: Logger
) => {
  const chatService = Container.get(ChatService)

  const messagesToBeInserted: { reference: `v2:${string}`; chatId: string; message: Message }[] = []

  while (threadhash != null) {
    const message: Message = await getMessage(threadhash)
    if (!message) {
      logger.debug(`Message not found for threadhash: ${threadhash}`)
      break
    }
    threadhash = message.link
    const reference = chatService.createMessageReference(message) as `v2:${string}`
    /**
     * @dev - Modify link only for non-intent messages
     */
    message.link = threadhash ? `previous:${reference}` : null
    if (!message.timestamp) {
      logger.debug(`Unable to find timestamp for message with cid ${threadhash}`)
      logger.debug(`Using fallBackTimestamp ${fallBackEpoch}`)
      message.timestamp = fallBackEpoch
    }
    messagesToBeInserted.push({ reference, chatId, message })

    // To ensure that the next message is not inserted before the previous one
    fallBackEpoch = message.timestamp - 1000
  }

  // Insert into chat_messages | fileStorage | IPFS
  // reverse the array to insert messages in the correct order
  for (const message of messagesToBeInserted.reverse()) {
    try {
      await chatService.insertMessage(message.reference, message.message, message.chatId)
    } catch (err) {
      logger.debug(`Error inserting message into chat_messages for chatId : ${chatId} : ${err}`)
    }
  }
}

const migrateChatMessagesTable = async (): Promise<boolean> => {
  const logger: Logger = Container.get('logger')

  let offset: number = 0
  const PAGE_SIZE = 5000
  let hasMore: boolean = true
  let skipedMessages: number = 0

  logger.debug('Populating chat_messages from w2w | fileStorage | IPFS')
  // Keep looping until there are no more records
  while (hasMore) {
    logger.info(`Fetching records from offset ${offset}...`)
    const chats: { threadhash: string; chat_id: string; epoch: string }[] = await new Promise<
      any[]
    >((resolve, reject) => {
      ;(db as any).query(
        `SELECT chat_id, threadhash, UNIX_TIMESTAMP(timestamp) as epoch from w2w order by id asc LIMIT ? OFFSET ?`,
        [PAGE_SIZE, offset],
        (err: any, results: { threradhash: string; chat_id: string; epoch: string }[]) => {
          if (err) return reject(err)
          resolve(results)
        }
      )
    })

    logger.info(`Processing ${chats.length} records...`)
    // If no records are fetched, stop the loop
    if (!chats.length) {
      hasMore = false
      logger.info('No more records to fetch.')
      break
    }

    // Process each record
    for (const row of chats) {
      const chatId = row.chat_id
      const threadHash = row.threadhash
      if (!threadHash) continue
      const fallBackTimestamp = parseInt(row.epoch) * 1000
      try {
        await llParser(threadHash, chatId, fallBackTimestamp, logger)
      } catch (err) {
        logger.error(`Error inserting messages into chat_messages for chatId : ${chatId} : ${err}`)
        skipedMessages++
      }
    }
    offset += PAGE_SIZE
  }
  // Increment the offset for the next page of records
  logger.info('Finished populating chat_messages from w2w_cid and fileStorage')
  logger.info(`Skipped ${skipedMessages} messages`)
  return true
}

const updateThreadHash = async (
  threadHash: string,
  intentTimestamp: string,
  chatId: string
): Promise<void> => {
  return await new Promise((resolve, reject) => {
    ;(db as any).query(
      'UPDATE w2w SET threadhash = ?, intent_timestamp = ? WHERE chat_id=?',
      [threadHash, intentTimestamp, chatId],
      (err, _) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

const migrateW2WTable = async (): Promise<boolean> => {
  const logger: Logger = Container.get('logger')

  let offset: number = 0
  const PAGE_SIZE = 5000
  let hasMore: boolean = true
  let skipedMessages: number = 0

  const chatService = Container.get(ChatService)

  logger.debug('Update w2w threadhash')
  // Keep looping until there are no more records
  while (hasMore) {
    logger.info(`Fetching records from offset ${offset}...`)
    const chats: { threadhash: string; chat_id: string; intent_timestamp: string }[] =
      await new Promise<any[]>((resolve, reject) => {
        ;(db as any).query(
          `SELECT chat_id, threadhash, intent_timestamp from w2w order by id asc LIMIT ? OFFSET ?`,
          [PAGE_SIZE, offset],
          (
            err: any,
            results: { threradhash: string; chat_id: string; intent_timestamp: string }[]
          ) => {
            if (err) return reject(err)
            resolve(results)
          }
        )
      })

    logger.info(`Processing ${chats.length} records...`)
    // If no records are fetched, stop the loop
    if (!chats.length) {
      hasMore = false
      logger.info('No more records to fetch.')
      break
    }

    // Process each record
    for (const row of chats) {
      const threadhash = row.threadhash
      const chatId = row.chat_id
      const intentTimestamp = row.intent_timestamp
      // Get the file from fileStorage
      if (threadhash == null) continue

      const message: Message = await readJsonFromFile(threadhash, FILE_STORAGE_DIR)
      if (!message) {
        logger.error(`Message not found for threadhash: ${threadhash}`)
        skipedMessages++
        continue
      }
      // Modify message Link to new Reference format
      const reference = chatService.createMessageReference(message)
      await updateThreadHash(reference, intentTimestamp, chatId)
    }
    // Increment the offset for the next page of records
    offset += PAGE_SIZE
  }
  logger.info('Finished updating w2w threadhash')
  logger.info(`Skipped ${skipedMessages} chats due to missing message`)
  return true
}

export const messageMigration = async () => {
  const migrationStatus = await getMigrationStatus()
  if (migrationStatus.started || migrationStatus.completed) {
    return
  }
  await changeMigrationStatus('migrationStatus', { started: true, completed: false })

  await migrateChatMessagesTable()
  await migrateW2WTable()

  await changeMigrationStatus('migrationStatus', { started: false, completed: true })
}
