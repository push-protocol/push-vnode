import { Container } from 'typedi'
import { Logger } from 'winston'

import * as db from '../../helpers/dbHelper'

/**
 * Delete all chat members for a specific chat_id
 * @param chatId
 */
export async function deleteChatMembers(chatId: string): Promise<void> {
  const logger: Logger = Container.get('logger')
  return new Promise(async (resolve, reject) => {
    ;(db as any).query(
      'DELETE FROM chat_members WHERE chat_id = ?',
      [chatId],
      (err: any, results: any) => {
        if (err) return reject(err)
        if (results.affectedRows === 0) {
          logger.info(`No members found for chat: ${chatId}`)
        }
        logger.info(`Deleted ${results.affectedRows} members for chat: ${chatId}`)
        return resolve()
      }
    )
  })
}

/**
 * Delete a specific chat member
 * @param param0 chatId and did of the member to delete
 * @returns
 */
export async function deleteChatMember({
  chatId,
  did
}: {
  chatId: string
  did: string
}): Promise<void> {
  const logger: Logger = Container.get('logger')
  return new Promise((resolve, reject) => {
    ;(db as any).query(
      `DELETE FROM chat_members WHERE chat_id = ? AND address = ?`,
      [chatId, did],
      (err: any, result: any) => {
        if (err) {
          logger.error(`Error deleting member with DID: ${did} from chat: ${chatId}`, err)
          return reject(err)
        }
        if (result.affectedRows === 0) {
          logger.info(`No member with DID: ${did} found in chat: ${chatId} to delete.`)
          return resolve() // Resolve even if no records were deleted to handle idempotency
        }
        logger.info(`Successfully deleted member with DID: ${did} from chat: ${chatId}`)
        resolve()
      }
    )
  })
}
