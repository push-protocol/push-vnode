import Container from 'typedi'

// @ts-ignore
import db from '../../helpers/dbHelper'
import { restrictAPICall } from '../../helpers/restrictAPICallHelper'
import {
  Chat,
  ChatMember,
  ChatMemberCounts,
  ChatMemberProfile,
  ChatMemberPublicKey,
  GroupConfig,
  GroupProfile,
  Inbox,
  IntentStatus,
  MemberUpdates,
  UserProfile
} from '../../interfaces/chat'
import ChatService, { getGroupDTO } from '../../services/chatService'
import { deleteChatMembers } from './chat-members'
import { getPgpEncType } from './w2w-meta'
const ENC_TYPE_V2 = 'aes256GcmHkdfSha256'
const ENC_TYPE_V3 = 'eip191-aes256-gcm-hkdf-sha256'
const ENC_TYPE_V4 = 'pgpv1:nft'

export async function getLatestThreadhash({
  combinedDID,
  isGroup = false,
  chatId = null
}: {
  combinedDID: string
  isGroup: boolean
  chatId: string
}): Promise<string> {
  return await new Promise((resolve, reject) => {
    if (!isGroup) {
      db.query(
        'SELECT threadhash FROM w2w WHERE combined_did=? AND group_name is NULL AND admins is NULL AND group_description is NULL',
        [combinedDID],
        async (err, result) => {
          if (err) return reject(err)
          if (result.length > 1) return reject()

          let threadhash: string = null

          // Check if there is a chat between the 2 wallets/dids
          if (result.length === 0) {
            return resolve(threadhash)
          }

          threadhash = result[0].threadhash
          return resolve(threadhash)
        }
      )
    } else {
      db.query('SELECT threadhash FROM w2w WHERE chat_id=?', [chatId], async (err, result) => {
        if (err) return reject(err)
        if (result.length > 1) return reject()

        let threadhash: string = null

        // Check if there is a chat between the 2 wallets/dids
        if (result.length === 0) {
          return resolve(threadhash)
        }

        threadhash = result[0].threadhash
        return resolve(threadhash)
      })
    }
  })
}

export async function getW2W(
  combinedDID: string
): Promise<{ hasIntent: boolean; threadhash: string }> {
  return await new Promise((resolve, reject) => {
    db.query(
      'SELECT intent, threadhash FROM w2w WHERE combined_did=?',
      combinedDID,
      async (err, result) => {
        if (err) return reject(err)
        if (result.length > 1) return reject()
        if (result.length === 0)
          return resolve({
            hasIntent: false,
            threadhash: null
          })
        else {
          return resolve({
            hasIntent: true,
            threadhash: result[0].threadhash
          })
        }
      }
    )
  })
}

export async function updateThreadHash({
  threadhash,
  combinedDID,
  isGroup = false,
  chatId = null
}: {
  threadhash: string
  combinedDID: string
  isGroup: boolean
  chatId: string
}): Promise<void> {
  return await new Promise((resolve, reject) => {
    if (!isGroup) {
      db.query(
        'UPDATE w2w SET threadhash = ? WHERE combined_did=? AND group_name IS NULL AND admins IS NULL AND group_description IS NULL',
        [threadhash, combinedDID],
        (err, _) => {
          if (err) return reject(err)
          return resolve()
        }
      )
    } else {
      db.query('UPDATE w2w SET threadhash = ? WHERE chat_id=?', [threadhash, chatId], (err, _) => {
        if (err) return reject(err)
        return resolve()
      })
    }
  })
}

export async function updateCombinedDID({
  oldCombinedDID,
  newCombinedDID
}: {
  oldCombinedDID: string
  newCombinedDID: string
}): Promise<void> {
  return await new Promise((resolve, reject) => {
    db.query(
      'UPDATE w2w SET combined_did = ? WHERE combined_did = ?',
      [newCombinedDID, oldCombinedDID],
      (err, _) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

export async function insertNewChat(chat: Chat): Promise<string> {
  return await new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO w2w (combined_did, threadhash, intent, intent_sent_by, chat_id, intent_timestamp) 
      VALUES (?,?,?,?,?,?)`,
      [
        chat.combinedDID,
        chat.threadhash,
        chat.intent,
        chat.intentSentBy,
        chat.chatId,
        chat.intentTimestamp
      ],
      (err, result) => {
        if (err) return reject(err)
        return resolve(result.insertId)
      }
    )
  })
}

/**
 * Get the chatId from the combinedDID
 * @param combinedDID combinedDID of the chat
 * @dev - This function only works for 1 to 1 chats
 */
export async function getChatIdFromCombinedDID(combinedDID: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    db.query(
      'SELECT chat_id FROM w2w WHERE combined_did=? AND group_name IS NULL AND admins IS NULL AND group_description IS NULL',
      [combinedDID],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) return resolve(null)
        return resolve(result[0].chat_id)
      }
    )
  })
}

export async function getChat({
  combinedDID,
  isGroup = false,
  chatId = null
}: {
  combinedDID: string
  isGroup: boolean
  chatId: string
}): Promise<Chat | null> {
  return await new Promise((resolve, reject) => {
    const query = isGroup
      ? 'SELECT * FROM w2w WHERE chat_id=?'
      : 'SELECT * FROM w2w WHERE combined_did=? AND group_name IS NULL AND admins IS NULL AND group_description IS NULL'

    const queryParams = isGroup ? [chatId] : [combinedDID]

    db.query(query, queryParams, async (err, result) => {
      if (err) return reject(err)
      if (result.length > 1) return reject()
      if (result.length === 0) return resolve(null)

      const chat = mapRowToChat(result[0]) // Use the helper function
      return resolve(chat)
    })
  })
}

export async function getChatByChatId({ chatId }: { chatId: string }): Promise<Chat> {
  return await new Promise((resolve, reject) => {
    db.query('SELECT * FROM w2w WHERE chat_id=?', [chatId], async (err, result) => {
      if (err) return reject(err)
      if (result.length > 1) return reject()
      if (result.length === 0) return resolve(null)
      const chat = mapRowToChat(result[0])
      return resolve(chat)
    })
  })
}

// This is applicable for groups
export async function getChatByChatIdV2({ chatId }: { chatId: string }): Promise<Chat | null> {
  const chatQuery = `
    SELECT id, threadhash, intent_sent_by, intent_timestamp, chat_id, group_name, 
           group_description, meta, profile_picture, is_public, contract_address_nft, 
           number_of_nfts, contract_address_erc20, number_of_erc20, verification_proof, 
           timestamp, group_type, schedule_at, schedule_end, status, rules, 
           profile_verification_proof, group_version, session_key
    FROM w2w
    WHERE chat_id=?;
  `

  try {
    const chatResult = await new Promise<any>((resolve, reject) => {
      db.query(chatQuery, [chatId], (err, result) => {
        if (err) reject(err)
        else resolve(result[0])
      })
    })

    if (!chatResult) return null

    // Construct the chat object with the mapped values
    const chat = {
      ...mapRowToChat(chatResult)
    }

    return chat
  } catch (error) {
    console.error('Error getting chat by chatId:', error)
    throw error
  }
}

export async function insertGroupDeltaVerificationProof({
  chatId,
  signer,
  verificationProof,
  payload
}: {
  chatId: string
  signer: string
  verificationProof: string
  payload: string
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const insertQuery = `
      INSERT INTO group_delta_verification_proof (chat_id, signer, verification_proof, payload)
      VALUES (?, ?, ?, ?);
    `

    db.query(insertQuery, [chatId, signer, verificationProof, payload], (err: any, result: any) => {
      if (err) {
        console.error(`Error inserting verification proof for chat: ${chatId}`, err)
        return reject(err)
      }
      resolve()
    })
  })
}

export async function updateW2WTable(chatId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Query to get all members and admins for this chatId
    const membersQuery = `
      SELECT address, role, intent FROM chat_members
      WHERE chat_id = ?;
    `

    db.query(membersQuery, [chatId], async (err: any, members: any) => {
      if (err) {
        console.error(`Error retrieving members for chat: ${chatId}`, err)
        return reject(err)
      }

      // Process members to format them for the w2w table
      let combinedDID = ''
      let admins = ''
      let intent = ''

      members.forEach((member: any) => {
        combinedDID += `${member.address}_`
        if (member.role === 'admin') {
          admins += `${member.address}_`
        }
        if (member.intent === 1) {
          intent += `${member.address}+`
        }
      })

      // Remove trailing separators
      combinedDID = combinedDID.slice(0, -1)
      admins = admins.slice(0, -1)
      intent = intent.slice(0, -1)

      // Update query for the w2w table
      const updateW2WQuery = `
        UPDATE w2w
        SET combined_did = ?,
            admins = ?,
            intent = ?
        WHERE chat_id = ?;
      `

      // Execute the update query
      db.query(
        updateW2WQuery,
        [combinedDID, admins, intent, chatId],
        (updateErr: any, result: any) => {
          if (updateErr) {
            console.error(`Error updating w2w table for chat: ${chatId}`, updateErr)
            return reject(updateErr)
          }
          resolve(combinedDID)
        }
      )
    })
  })
}

export async function searchGroupsByText({
  searchTerm,
  pageNumber,
  pageSize
}: {
  searchTerm: string
  pageNumber: number
  pageSize: number
}): Promise<Chat[]> {
  const startIndex = (pageNumber - 1) * pageSize

  return await new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM w2w WHERE group_name LIKE ? AND group_type = 'default' LIMIT ?, ?`,
      [`%${searchTerm}%`, startIndex, pageSize],
      async (err, result) => {
        if (err) return reject(err)

        const chats: Chat[] = result.map((row) => mapRowToChat(row))

        resolve(chats)
      }
    )
  })
}

export async function searchSpacesByText({
  searchTerm,
  pageNumber,
  pageSize
}: {
  searchTerm: string
  pageNumber: number
  pageSize: number
}): Promise<Chat[]> {
  const startIndex = (pageNumber - 1) * pageSize

  return await new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM w2w WHERE group_name LIKE ? AND group_type = 'spaces' AND (status = 'ACTIVE' OR status = 'PENDING') LIMIT ?, ?`,
      [`%${searchTerm}%`, startIndex, pageSize],
      async (err, result) => {
        if (err) return reject(err)

        const chats: Chat[] = result.map((row) => mapRowToChat(row))

        resolve(chats)
      }
    )
  })
}

function mapRowToChat(row) {
  return {
    combinedDID: row.combined_did,
    intent: row.intent,
    intentSentBy: row.intent_sent_by,
    threadhash: row.threadhash,
    intentTimestamp: row.intent_timestamp,
    admins: row.admins,
    chatId: row.chat_id,
    isPublic: row.is_public,
    contractAddressERC20: row.contract_address_erc20,
    numberOfERC20: row.number_of_erc20,
    contractAddressNFT: row.contract_address_nft,
    numberOfNFTs: row.number_of_nfts,
    verificationProof: row.verification_proof,
    groupImage: row.profile_picture,
    groupName: row.group_name,
    groupDescription: row.group_description,
    meta: row.meta,
    scheduleAt: row.schedule_at,
    scheduleEnd: row.schedule_end,
    groupType: row.group_type,
    status: row.status,
    rules: row.rules ? JSON.parse(row.rules) : {},
    sessionKey: row.session_key
  }
}

export async function getChatByGroupName({ groupName }: { groupName: string }): Promise<Chat> {
  return await new Promise((resolve, reject) => {
    db.query('SELECT * FROM w2w WHERE group_name=? LIMIT 1', [groupName], async (err, result) => {
      if (err) return reject(err)
      if (result.length === 0) return resolve(null)

      const chat = mapRowToChat(result[0]) // Use the helper function
      return resolve(chat)
    })
  })
}

export async function getChatByThreadhash({ threadhash }: { threadhash: string }): Promise<Chat> {
  return await new Promise((resolve, reject) => {
    db.query('SELECT * FROM w2w WHERE threadhash=?', [threadhash], async (err, result) => {
      if (err) return reject(err)
      if (result.length > 1) return reject()
      if (result.length === 0) return resolve(null)
      const chat: Chat = {
        combinedDID: result[0].combined_did,
        intent: result[0].intent,
        intentSentBy: result[0].intent_sent_by,
        threadhash: result[0].threadhash,
        intentTimestamp: result[0].intent_timestamp,
        chatId: result[0].chat_id,
        scheduleAt: result[0].schedule_at,
        scheduleEnd: result[0].schedule_end,
        groupType: result[0].group_type,
        status: result[0].status,
        sessionKey: result[0].session_key,
        rules: result[0].rules ? JSON.parse(result[0].rules) : {}
      }
      return resolve(chat)
    })
  })
}

export async function getChats({ did }: { did: string }): Promise<Chat[]> {
  return await new Promise((resolve, reject) => {
    const dynamicInput = '%'.concat(did.concat('%'))
    db.query('SELECT * FROM w2w WHERE combined_did LIKE ?', [dynamicInput], async (err, result) => {
      if (err) return reject(err)
      if (result.length === 0) return resolve(null)
      const chats: Chat[] = []
      for (const res of result) {
        chats.push({
          combinedDID: res.combined_did,
          intent: res.intent,
          intentSentBy: res.intent_sent_by,
          threadhash: res.threadhash,
          intentTimestamp: res.intent_timestamp,
          chatId: res.chat_id,
          scheduleAt: res.schedule_at,
          scheduleEnd: res.schedule_end,
          groupType: res.group_type,
          status: res.status,
          sessionKey: res.session_key,
          rules: result[0].rules ? JSON.parse(result[0].rules) : {}
        })
      }
      return resolve(chats)
    })
  })
}

export async function hasIntent({ combinedDID }: { combinedDID: string }): Promise<boolean> {
  return await new Promise((resolve, reject) => {
    db.query(
      'SELECT intent FROM w2w WHERE combined_did=? AND group_name IS NULL',
      [combinedDID],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length > 1) return reject()
        if (result.length === 0) return resolve(false)
        return resolve(true)
      }
    )
  })
}

// TODO: Break this function into smaller functions e.g. approving intent only for wallet to wallet and other just for groups
export async function updateIntent({
  combinedDID,
  status,
  did,
  isGroup = false,
  chatId = null,
  groupInformation: { autoJoin = false }
}: {
  combinedDID: string
  status: string
  did: string
  isGroup: boolean
  chatId: string
  groupInformation: { autoJoin: boolean }
}): Promise<string> {
  return await new Promise((resolve, reject) => {
    if (!isGroup) {
      let query: string
      if (status === IntentStatus.Approved) {
        query = 'UPDATE w2w SET intent = CONCAT(intent, "+", ?) WHERE combined_did=?'
      } else if (status === IntentStatus.Reproved) {
        throw new Error('Invalid Intent Status')
      } else throw new Error('Invalid Intent Status')
      db.query(query, [did, combinedDID], async (err: any) => {
        if (err) return reject(err)
        const updatedChat = await getChat({ combinedDID, isGroup, chatId })
        return resolve(updatedChat.intent)
      })
    } else {
      // Normal. User has an intent and it's approving it
      if (!autoJoin) {
        db.query(
          'UPDATE w2w SET intent = CONCAT(intent, "+", ?) WHERE chat_id=?',
          [did, chatId],
          async (err: any) => {
            if (err) return reject(err)
            const updatedChat = await getChatByChatId({ chatId })
            return resolve(updatedChat.intent)
          }
        )
      } else {
        db.query(
          'UPDATE w2w SET combined_did = ?, intent = CONCAT(intent, "+", ?) WHERE chat_id=?',
          [combinedDID, did, chatId],
          async (err: any) => {
            if (err) return reject(err)
            const updatedChat = await getChatByChatId({ chatId })
            return resolve(updatedChat.intent)
          }
        )
      }
    }
  })
}

export async function rejectIntent({
  combinedDID,
  did,
  isGroup = false,
  chatId = null
}: {
  combinedDID: string
  did: string
  isGroup: boolean
  chatId: string
}): Promise<void> {
  return await new Promise((resolve, reject) => {
    if (!isGroup) {
      const query = 'DELETE from w2w WHERE combined_did=?'
      db.query(query, [combinedDID], (err: any) => {
        if (err) return reject(err)
        else resolve()
      })
    } else {
      const updateQuery = `
        UPDATE w2w 
        SET 
          combined_did = TRIM(BOTH '_' FROM REPLACE(REPLACE(combined_did, ?, ''), '__', '_')),
          admins = TRIM(BOTH '_' FROM REPLACE(REPLACE(admins, ?, ''), '__', '_'))
        WHERE chat_id=?
      `
      db.query(updateQuery, [did, did, chatId], (err: any) => {
        if (err) return reject(err)
        else resolve()
      })
    }
  })
}

export async function getIntentsSent(caip10: string): Promise<any> {
  return await new Promise((resolve, reject) => {
    // var dynamicInput = "%".concat(caip10.concat("%"));
    db.query(
      `SELECT * from w2w WHERE intent_sent_by = ? AND admins is NULL`,
      [caip10],
      async (err, result) => {
        if (err) reject(err)
        return resolve(result)
      }
    )
  })
}

export async function updateGroupSessionKey(chatId: string, sessionKey: string) {
  return await new Promise((resolve, reject) => {
    db.query(
      `UPDATE w2w SET session_key = ? WHERE chat_id = ?`,
      [sessionKey, chatId],
      async (err, result) => {
        if (err) reject(err)
        return resolve(null)
      }
    )
  })
}

export async function populateChatMembersByChatId(chatId: string): Promise<void> {
  // Query the w2w table to get combined_did, admins, and intent for the given chatId
  const selectQuery = `
    SELECT combined_did, admins, intent
    FROM w2w
    WHERE chat_id = ?;
  `

  const w2wResult = await new Promise<any>((resolve, reject) => {
    db.query(selectQuery, [chatId], (err, results) => {
      if (err) {
        console.error(`Error fetching w2w data for chat_id: ${chatId}`, err)
        reject(err)
      } else {
        resolve(results[0]) // Assuming each chatId has a unique entry in w2w table
      }
    })
  })

  // Destructure the fetched results
  const { combined_did, admins, intent } = w2wResult

  // Proceed to populate the chat_members table
  await populateChatMembersForChat(chatId, combined_did, admins, intent)
}

export async function populateChatMembersForChat(
  chatId: string,
  combinedDid: string,
  admins: string,
  intent: string
): Promise<void> {
  const combinedDidArray = combinedDid.toLowerCase().split('_')
  const adminArray = admins ? admins.toLowerCase().split('_') : []
  const intentArray = intent ? intent.toLowerCase().split('+') : []

  // First, fetch the current members for this chat
  const currentMembersQuery = 'SELECT address FROM chat_members WHERE chat_id = ?;'
  const currentMembers = await new Promise<string[]>((resolve, reject) => {
    db.query(currentMembersQuery, [chatId], (err, results) => {
      if (err) {
        console.error(`Error fetching current chat_members for chat_id: ${chatId}`, err)
        reject(err)
      } else {
        resolve(results.map((r) => r.address.toLowerCase()))
      }
    })
  })

  // Find members that need to be removed
  const membersToRemove = currentMembers.filter((member) => !combinedDidArray.includes(member))

  // Remove members that are not in the new combinedDidArray
  for (const member of membersToRemove) {
    const deleteQuery = 'DELETE FROM chat_members WHERE chat_id = ? AND address = ?;'
    await new Promise<void>((resolve, reject) => {
      db.query(deleteQuery, [chatId, member], (err) => {
        if (err) {
          console.error(`Error deleting chat_member: ${member} for chat_id: ${chatId}`, err)
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  // Upsert new and existing members
  for (const did of combinedDid.split('_')) {
    const role = adminArray.includes(did.toLowerCase()) ? 'admin' : 'member'
    const intentFlag = intentArray.includes(did.toLowerCase()) ? 1 : 0

    const upsertQuery = `
      INSERT INTO chat_members (chat_id, address, role, intent)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        role = VALUES(role),
        intent = VALUES(intent);
    `

    await new Promise<void>((resolve, reject) => {
      db.query(upsertQuery, [chatId, did, role, intentFlag], (err) => {
        if (err) {
          console.error(`Error updating chat_members for did: ${did}`, err)
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
}

export async function createGroup(groupChat: Chat): Promise<void> {
  if (groupChat.combinedDID.includes(',')) throw Error("combined_did contains ','")
  return await new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO w2w (combined_did, threadhash, intent, intent_sent_by, intent_timestamp, chat_id, group_name, group_description, profile_picture, admins, is_public, contract_address_nft, number_of_nfts, contract_address_erc20, number_of_erc20, verification_proof, meta, schedule_at, schedule_end, group_type, status, rules, profile_verification_proof, config_verification_proof, group_version) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        groupChat.combinedDID,
        groupChat.threadhash,
        groupChat.intent,
        groupChat.intentSentBy,
        groupChat.intentTimestamp,
        groupChat.chatId,
        groupChat.groupName,
        groupChat.groupDescription,
        groupChat.groupImage,
        groupChat.admins,
        groupChat.isPublic,
        groupChat.contractAddressNFT,
        groupChat.numberOfNFTs,
        groupChat.contractAddressERC20,
        groupChat.numberOfERC20,
        groupChat.verificationProof,
        groupChat.meta,
        groupChat.scheduleAt,
        groupChat.scheduleEnd,
        groupChat.groupType,
        groupChat.status,
        groupChat.rules ? JSON.stringify(groupChat.rules) : JSON.stringify({}),
        groupChat.profileVerificationProof,
        groupChat.configVerificationProof,
        groupChat.groupVersion
      ],
      (err, result) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

export async function updateGroupMembers({
  members,
  admins,
  intent,
  chatId,
  groupName,
  groupDescription,
  groupImage,
  verificationProof,
  profileVerificationProof = null,
  meta,
  scheduleAt,
  scheduleEnd,
  status
}: {
  members: string
  admins: string
  intent: string
  chatId: string
  groupName: string
  groupDescription: string
  groupImage: string
  verificationProof: string
  profileVerificationProof?: string | null
  meta: string
  scheduleAt?: Date | null
  scheduleEnd?: Date | null
  status?: string | null
}): Promise<void> {
  return await new Promise((resolve, reject) => {
    if (members.split('_').length > 1 && !members.includes('_'))
      throw Error('MEMBERS SHOULD BE SEPARATED BY _')
    db.query(
      'UPDATE w2w SET combined_did = ?, admins = ?, intent = ?, group_name = ?, group_description = ?, profile_picture = ?, verification_proof = ?, profile_verification_proof = ?, meta = ?, schedule_at = ?, schedule_end = ?, status = ? WHERE chat_id = ?',
      [
        members,
        admins,
        intent,
        groupName,
        groupDescription,
        groupImage,
        verificationProof,
        profileVerificationProof,
        meta,
        scheduleAt,
        scheduleEnd,
        status,
        chatId
      ],
      (err, _) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

export async function updateGroupProfile(groupProfile: GroupProfile): Promise<void> {
  const {
    groupName,
    groupDescription,
    groupImage,
    rules,
    isPublic,
    groupType,
    profileVerificationProof,
    chatId
  } = groupProfile
  return await new Promise((resolve, reject) => {
    db.query(
      'UPDATE w2w SET group_name = ?, group_description = ?, profile_picture = ?, rules = ?, is_public = ?, group_type = ?, profile_verification_proof = ? WHERE chat_id = ?',
      [
        groupName,
        groupDescription,
        groupImage,
        JSON.stringify(rules),
        isPublic,
        groupType,
        profileVerificationProof,
        chatId
      ],
      (err, _) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

export async function updateGroupConifg(groupConfig: GroupConfig): Promise<void> {
  const { meta, scheduleAt, scheduleEnd, status, configVerificationProof, chatId } = groupConfig
  return await new Promise((resolve, reject) => {
    db.query(
      'UPDATE w2w SET meta = ?, schedule_at = ?, schedule_end = ?, status = ?, config_verification_proof = ? WHERE chat_id = ?',
      [meta, scheduleAt, scheduleEnd, status, configVerificationProof, chatId],
      (err, _) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

/**
 * This endpoint returns the total number of groups an address has created.
 * @param did DID/wallet of the user
 * @returns Total number of groups an address has created
 */
export async function getCountGroupChats({ did }: { did: string }): Promise<number> {
  return await new Promise((resolve, reject) => {
    db.query(
      'SELECT count(*) as totalGroupCount FROM `w2w` WHERE admins IS NOT NULL AND intent_sent_by = ? AND (group_type IS NULL OR group_type = "default");',
      [did],
      async (err, result) => {
        if (err) return reject(err)
        return resolve(result[0].totalGroupCount)
      }
    )
  })
}

export async function getCountSpaces({ did }: { did: string }): Promise<number> {
  return await new Promise((resolve, reject) => {
    db.query(
      'SELECT count(*) as totalGroupCount FROM `w2w` WHERE admins IS NOT NULL AND intent_sent_by = ? AND group_type = "spaces";',
      [did],
      async (err, result) => {
        if (err) return reject(err)
        return resolve(result[0].totalGroupCount)
      }
    )
  })
}

/**
 * This function returns all the groups an address belongs to
 * @param address: Address to find groups it belongs to
 * @returns Array of inbox
 */
export async function getGroupsAddressBelongsTo({
  address,
  isGroupRequest
}: {
  address: string
  isGroupRequest: boolean
}): Promise<Inbox[]> {
  const dynamicInput = '%'.concat(address.concat('%'))
  return await new Promise((resolve, reject) => {
    let query: string
    if (!isGroupRequest)
      query = `SELECT * FROM w2w WHERE combined_did LIKE ? AND group_name IS NOT NULL AND admins IS NOT NULL AND intent LIKE ?`
    else
      query =
        'SELECT * FROM w2w WHERE combined_did LIKE ? AND group_name IS NOT NULL AND admins IS NOT NULL AND intent NOT LIKE ?'

    db.query(query, [dynamicInput, dynamicInput], async (err, result) => {
      const inbox: Inbox[] = []
      if (err) return reject(err)
      for (const group of result) {
        const inboxToBeAdded: Inbox = {
          chatId: group.chat_id,
          about: group.about,
          combinedDID: group.combined_did,
          did: null,
          intent: group.intent,
          intentSentBy: group.intent_sent_by,
          intentTimestamp: group.intent_timestamp,
          name: null,
          profilePicture: null,
          publicKey: null,
          threadhash:
            group.threadhash == null || group.threadhash.length == 0 ? null : group.threadhash,
          wallets: null,
          groupInformation: null
        }

        inboxToBeAdded.groupInformation = await getGroupDTO(group.chat_id)
        inbox.push(inboxToBeAdded)
      }
      return resolve(inbox)
    })
  })
}

export async function getEncryptedSecretBySessionKey({
  sessionKey
}: {
  sessionKey: string
}): Promise<string | null> {
  return await new Promise((resolve, reject) => {
    db.query(
      'SELECT encrypted_secret FROM session_keys WHERE session_key = ?',
      [sessionKey],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) return resolve(null)
        return resolve(result[0].encrypted_secret)
      }
    )
  })
}

export async function fetchChatMembersWithProfile(
  chatId: string,
  pageSize: number,
  pageNumber: number,
  pending?: boolean,
  role?: string
): Promise<ChatMemberProfile[]> {
  console.time('fetchChatMembersWithProfile') // Start timing the entire function
  const offset = (pageNumber - 1) * pageSize
  console.time('queryExecution') // Start timing the query execution

  let query = `
        SELECT 
            cm.address, 
            cm.intent, 
            cm.role, 
            wm.wallets, 
            wm.profile, 
            wm.did, 
            wm.pgp_pub, 
            wm.pgp_priv_enc, 
            wm.allowed_num_msg, 
            wm.num_msg, 
            wm.verification_proof, 
            wm.origin
        FROM 
            chat_members cm
        LEFT JOIN 
            w2w_meta wm ON cm.address = wm.did
        WHERE 
            cm.chat_id = ?`

  const queryParams: (string | number)[] = [chatId]

  if (pending !== undefined) {
    query += ` AND cm.intent = ${pending ? 0 : 1}`
  }

  if (role) {
    query += ` AND cm.role = ?`
    queryParams.push(role)
  }

  query += ` ORDER BY cm.id DESC LIMIT ? OFFSET ?`

  queryParams.push(pageSize, offset)

  return new Promise((resolve, reject) => {
    db.query(query, queryParams, (err, results) => {
      console.timeEnd('queryExecution') // End timing the query execution
      if (err) {
        console.error('Database query failed:', err)
        reject(err)
      } else {
        console.time('processingResults') // Start timing the results processing
        const members: ChatMemberProfile[] = results.map((row) => {
          const profile: UserProfile = row.profile ? JSON.parse(row.profile) : {}
          // Used for Parsing PGP Public key of members
          const encryptionVersion = getPgpEncType(row.pgp_priv_enc)
          const publicKey =
            encryptionVersion === ENC_TYPE_V2 ||
            encryptionVersion === ENC_TYPE_V3 ||
            encryptionVersion === ENC_TYPE_V4
              ? JSON.parse(row.pgp_pub).key || row.pgp_pub
              : row.pgp_pub || ''
          return {
            address: row.address,
            intent: row.intent === 1,
            role: row.role,
            userInfo: {
              did: row.did ?? row.address,
              wallets: row.wallets ?? row.address,
              publicKey: publicKey ?? '',
              encryptedPrivateKey: row.pgp_priv_enc ?? '',
              verificationProof: row.verification_proof,
              msgSent: row.num_msg ?? 0,
              maxMsgPersisted: row.allowed_num_msg ?? 1000,
              profile: profile,
              origin: row.origin
            }
          }
        })
        console.timeEnd('processingResults') // End timing the results processing
        resolve(members)
      }
      console.timeEnd('fetchChatMembersWithProfile') // End timing the entire function
    })
  })
}

export async function fetchChatMembersWithPublicKey(
  chatId: string,
  pageSize: number,
  pageNumber: number
): Promise<ChatMemberPublicKey[]> {
  console.time('fetchChatMembersWithPublicKey') // Start timing the entire function
  const offset = (pageNumber - 1) * pageSize
  console.time('queryExecution') // Start timing the query execution

  const query = `
    SELECT 
        cm.address,  
        wm.pgp_pub, 
        wm.pgp_priv_enc
    FROM 
        chat_members cm
    LEFT JOIN 
        w2w_meta wm ON cm.address = wm.did
    WHERE 
        cm.chat_id = ? AND cm.intent = 1
    ORDER BY 
        cm.id DESC
    LIMIT ? OFFSET ?;
  `

  return new Promise((resolve, reject) => {
    db.query(query, [chatId, pageSize, offset], (err, results) => {
      console.timeEnd('queryExecution') // End timing the query execution
      if (err) {
        console.error('Database query failed:', err)
        reject(err)
      } else {
        console.time('processingResults') // Start timing the results processing
        const members: ChatMemberPublicKey[] = results.map((row) => {
          // Used for Parsing PGP Public key of members
          const encryptionVersion = getPgpEncType(row.pgp_priv_enc)
          const publicKey =
            encryptionVersion === ENC_TYPE_V2 ||
            encryptionVersion === ENC_TYPE_V3 ||
            encryptionVersion === ENC_TYPE_V4
              ? JSON.parse(row.pgp_pub).key || row.pgp_pub
              : row.pgp_pub || ''
          return {
            did: row.address,
            publicKey: publicKey ?? ''
          }
        })
        console.timeEnd('processingResults') // End timing the results processing
        resolve(members)
      }
      console.timeEnd('fetchChatMembersWithPublicKey') // End timing the entire function
    })
  })
}

export async function fetchAllChatMembersWithProfile(chatId: string): Promise<ChatMemberProfile[]> {
  const query = `
    SELECT 
      cm.address, 
      cm.intent, 
      cm.role, 
      wm.wallets, 
      wm.profile, 
      wm.did, 
      wm.pgp_pub, 
      wm.pgp_priv_enc, 
      wm.allowed_num_msg, 
      wm.num_msg, 
      wm.verification_proof, 
      wm.origin
    FROM 
      chat_members cm
    LEFT JOIN 
      w2w_meta wm ON cm.address = wm.did
    WHERE 
      cm.chat_id = ?
    ORDER BY 
      cm.id DESC;
  `

  return new Promise((resolve, reject) => {
    db.query(query, [chatId], (err, results) => {
      if (err) {
        reject(err)
      } else {
        const members = results.map((row) => {
          let profile
          try {
            profile = row.profile ? JSON.parse(row.profile) : {}
          } catch (parseError) {
            console.error('Failed to parse profile JSON:', parseError)
            profile = {}
          }

          // Used for Parsing PGP Public key of members
          const encryptionVersion = getPgpEncType(row.pgp_priv_enc)
          const publicKey =
            encryptionVersion === ENC_TYPE_V2 ||
            encryptionVersion === ENC_TYPE_V3 ||
            encryptionVersion === ENC_TYPE_V4
              ? JSON.parse(row.pgp_pub).key || row.pgp_pub
              : row.pgp_pub || ''

          return {
            address: row.address,
            intent: row.intent === 1,
            role: row.role,
            userInfo: {
              did: row.did ?? row.address,
              wallets: row.wallets ?? row.address,
              publicKey: publicKey ?? '',
              encryptedPrivateKey: row.pgp_priv_enc ?? '',
              verificationProof: row.verification_proof,
              msgSent: row.num_msg ?? 0,
              maxMsgPersisted: row.allowed_num_msg ?? 1000,
              profile: profile,
              origin: row.origin
            }
          }
        })
        resolve(members)
      }
    })
  })
}

export async function getGroupMemberCount(chatId: string): Promise<ChatMemberCounts> {
  const query = `
    SELECT 
      COUNT(*) AS overallCount,
      SUM(CASE WHEN role = 'admin' AND intent = 1 THEN 1 ELSE 0 END) AS adminsCount,
      SUM(CASE WHEN role = 'member' AND intent = 1 THEN 1 ELSE 0 END) AS membersCount,
      SUM(CASE WHEN role = 'admin' AND intent = 0 THEN 1 ELSE 0 END) AS adminPendingCount,
      SUM(CASE WHEN role = 'member' AND intent = 0 THEN 1 ELSE 0 END) AS memberPendingCount,
      SUM(CASE WHEN intent = 0 THEN 1 ELSE 0 END) AS pendingCount,
      SUM(CASE WHEN intent = 1 THEN 1 ELSE 0 END) AS approvedCount
    FROM chat_members
    WHERE chat_id = ?;
  `

  return new Promise((resolve, reject) => {
    db.query(query, [chatId], (err, results) => {
      if (err) {
        reject(err)
      } else {
        const counts: ChatMemberCounts = {
          overallCount: results[0].overallCount,
          adminsCount: results[0].adminsCount,
          membersCount: results[0].membersCount,
          pendingCount: results[0].pendingCount,
          approvedCount: results[0].approvedCount,
          roles: {
            ADMIN: {
              total: results[0].adminsCount,
              pending: results[0].adminPendingCount
            },
            MEMBER: {
              total: results[0].membersCount,
              pending: results[0].memberPendingCount
            }
          }
        }
        resolve(counts)
      }
    })
  })
}

export async function getMembersByAddresses(
  chatId: string,
  addresses: string[]
): Promise<ChatMember[]> {
  if (addresses.length === 0) return []

  const placeholders = addresses.map(() => '?').join(',')
  const query = `
    SELECT * FROM chat_members
    WHERE chat_id = ? AND address IN (${placeholders});
  `

  return new Promise<ChatMember[]>((resolve, reject) => {
    db.query(query, [chatId, ...addresses], (err, results) => {
      if (err) {
        reject(err)
      } else {
        resolve(results)
      }
    })
  })
}

/**
 * Checks if a member with the given address and chatId has a certain intent.
 * @param {string} chatId - The ID of the chat.
 * @param {string} address - The address of the chat member.
 * @returns {Promise<boolean|null>} - Returns true or false based on intent, or null if no record is found.
 */
export async function checkMemberIntentForGroup(
  chatId: string,
  address: string
): Promise<boolean | null> {
  const query = `
    SELECT intent FROM chat_members
    WHERE chat_id = ? AND address = ?;
  `

  return new Promise((resolve, reject) => {
    db.query(query, [chatId, address], (err, results) => {
      if (err) {
        reject(err)
      } else if (results.length === 0) {
        resolve(null) // No record found
      } else {
        const intent = results[0].intent
        resolve(intent === 1) // Resolve with true if intent is 1, otherwise false
      }
    })
  })
}

/**
 * Checks if all members of a chat with the given chatId have a certain intent set to true.
 * @param {string} chatId - The ID of the chat.
 * @returns {Promise<boolean|null>} - Returns true if all members have intent true, false if any have intent false, or null if no records are found.
 */
export async function checkMembersIntentForW2W(chatId: string): Promise<boolean | null> {
  const query = `
    SELECT intent FROM chat_members
    WHERE chat_id = ?;
  `

  return new Promise((resolve, reject) => {
    db.query(query, [chatId], (err, results) => {
      if (err) {
        reject(err)
      } else if (results.length === 0) {
        resolve(null) // No records found for the chatId
      } else {
        const allTrue = results.every((row) => row.intent === 1)
        resolve(allTrue) // true if all intents are 1, otherwise false
      }
    })
  })
}

export async function isAddressAdminWithIntentInGroup(
  chatId: string,
  address: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 1 FROM chat_members
      WHERE chat_id = ? AND address = ? AND role = 'admin' AND intent = 1;
    `

    // Assuming db is your database connection object
    db.query(query, [chatId, address], (err, results) => {
      if (err) {
        console.error(
          `Error checking admin status with intent for address: ${address} in chat: ${chatId}`,
          err
        )
        return reject(err)
      }
      // If a record is found, then the address is an admin with intent true
      resolve(results.length > 0)
    })
  })
}

export async function insertSessionKey({
  sessionKey,
  encryptedSecret
}: {
  sessionKey: string
  encryptedSecret: string
}): Promise<void> {
  return await new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO session_keys (session_key, encrypted_secret) 
      VALUES (?,?)`,
      [sessionKey, encryptedSecret],
      (err, result) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

/**
 * Get Expired Groups / Spaces
 * @param limit No. of groups to fetch
 * @returns List of chat_ids of expired groups
 */
export async function getExpiredGroups(limit: number): Promise<string[]> {
  const query =
    'SELECT chat_id FROM w2w WHERE schedule_end <= DATE_SUB(NOW(), INTERVAL 14 DAY) LIMIT ?'
  return await new Promise((resolve, reject) => {
    db.query(query, [limit], async (err: any, results: { chat_id: string }[]) => {
      if (err) return reject(err)
      const chatIds = results.map((result) => result.chat_id)
      return resolve(chatIds)
    })
  })
}

/**
 * Delete Expired Groups / Spaces with a given chat_id
 * @param chatId chat_id of the group to be deleted
 */
export async function deleteExpiredGroup(chatId: string): Promise<void> {
  return await new Promise((resolve, reject) => {
    db.query(
      'DELETE FROM w2w WHERE chat_id = ? AND schedule_end <= DATE_SUB(NOW(), INTERVAL 14 DAY)',
      [chatId],
      (err: any) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

/*Case 1: remove just remove the entries
Case 2: add admins 
          if new admins -> add in table with intent 0
          if already admins -> skip
          if already member -> change to admin, no change in intent
Case 3: add members 
          if new members -> add in table with intent 0
          if already members -> skip
          if already admin -> change to member, no change in intent*/

export async function updateGroupMembersInDB(
  chatId: string,
  admins: string[],
  members: string[],
  remove: string[],
  isAutoJoin: boolean
): Promise<MemberUpdates> {
  // Fetch current chat members from the database
  const currentMembers: ChatMember[] = await getMembersByAddresses(chatId, [
    ...admins,
    ...members,
    ...remove
  ])

  const memberUpdates: MemberUpdates = {
    add: { admins: [], members: [] },
    remove: { admins: [], members: [] },
    change: []
  }

  // Create a map for quick lookup
  const currentMembersMap = new Map(
    currentMembers.map((member) => [member.address.toLowerCase(), member])
  )

  // Bulk remove members
  if (remove.length > 0) {
    const removePlaceholders = remove.map(() => '?').join(',')
    const removeQuery = `DELETE FROM chat_members WHERE chat_id = ? AND address IN (${removePlaceholders});`

    await new Promise((resolve, reject) => {
      db.query(removeQuery, [chatId, ...remove], (err, results) => {
        if (err) {
          reject(err)
        } else {
          resolve(results)
        }
      })
    })

    remove.forEach((address) => {
      const role = currentMembersMap.get(address.toLowerCase())?.role
      if (role) {
        if (role === 'admin') {
          memberUpdates.remove.admins.push(address)
        } else if (role === 'member') {
          memberUpdates.remove.members.push(address)
        }
      }
    })
  }

  // Prepare bulk insert for admins and members
  const insertValues: string[] = []
  const updateQueries: string[] = []

  for (const admin of admins) {
    if (!currentMembersMap.has(admin.toLowerCase())) {
      insertValues.push(`('${chatId}', '${admin}', 'admin', 0)`)
      memberUpdates.add.admins.push(admin)
    } else if (currentMembersMap.get(admin.toLowerCase())?.role !== 'admin') {
      updateQueries.push(
        `UPDATE chat_members SET role = 'admin' WHERE chat_id = '${chatId}' AND address = '${admin}';`
      )
      memberUpdates.change.push({
        address: admin,
        newRole: 'admin',
        previousRole: currentMembersMap.get(admin)?.role || ''
      })
    }
  }

  if (isAutoJoin) {
    insertValues.push(`('${chatId}', '${members[0]}', 'member', 1)`)
  } else {
    for (const member of members) {
      if (!currentMembersMap.has(member.toLowerCase()) && !admins.includes(member)) {
        insertValues.push(`('${chatId}', '${member}', 'member', 0)`)
        memberUpdates.add.members.push(member)
      } else if (currentMembersMap.get(member.toLowerCase())?.role !== 'member') {
        updateQueries.push(
          `UPDATE chat_members SET role = 'member' WHERE chat_id = '${chatId}' AND address = '${member}';`
        )
        memberUpdates.change.push({
          address: member,
          newRole: 'member',
          previousRole: currentMembersMap.get(member)?.role || ''
        })
      }
    }
  }

  // Execute bulk insert for new admins and members
  if (insertValues.length > 0) {
    const insertQuery = `
                  INSERT INTO chat_members (chat_id, address, role, intent)
                  VALUES ${insertValues.join(', ')}
                  ON DUPLICATE KEY UPDATE role = VALUES(role), intent = VALUES(intent);
                `
    await new Promise((resolve, reject) => {
      db.query(insertQuery, [], (err, results) => {
        if (err) {
          reject(err)
        } else {
          resolve(results)
        }
      })
    })
  }

  // Execute bulk update for role changes
  if (updateQueries.length > 0) {
    await Promise.all(
      updateQueries.map(
        (query) =>
          new Promise((resolve, reject) => {
            db.query(query, [], (err, results) => {
              if (err) {
                reject(err)
              } else {
                resolve(results)
              }
            })
          })
      )
    )
  }
  return memberUpdates
}

/**
 *********************************************************
 *********************************************************
 * **INTERNAL FUNCTION FOR TESTING PURPOSES ONLY**
 *********************************************************
 *********************************************************
 */
export async function _deleteRequest({ combinedDID }: { combinedDID: string }): Promise<void> {
  const chatId: string = await new Promise((resolve, reject) => {
    restrictAPICall('/tests/', '/src/')
    // Not for groups
    db.query(
      'SELECT chat_id from w2w WHERE combined_did = ?',
      [combinedDID],
      async (err: any, res) => {
        if (err) return reject(err)
        if (res.length === 0) return resolve(null)
        return resolve(res[0].chat_id)
      }
    )
  })
  if (!chatId) return

  const chat = Container.get(ChatService)

  return await new Promise((resolve, reject) => {
    restrictAPICall('/tests/', '/src/')
    // Not for groups
    db.query('DELETE FROM w2w WHERE chat_id = ?', [chatId], async (err: any) => {
      if (err) return reject(err)
      await deleteChatMembers(chatId)
      await chat.removeMessagesForChatId(chatId)
      return resolve()
    })
  })
}

export async function _deleteChatByChatId({ chatId }: { chatId: string }): Promise<void> {
  const chat = Container.get(ChatService)
  return await new Promise((resolve, reject) => {
    restrictAPICall('/tests/', '/src/')
    // Not for groups
    db.query('DELETE FROM w2w WHERE chat_id = ?', [chatId], async (err: any) => {
      if (err) return reject(err)
      await deleteChatMembers(chatId)
      await chat.removeMessagesForChatId(chatId)
      return resolve()
    })
  })
}

export async function _updateUserNumberOfMessages({
  did,
  numberOfMessages
}: {
  did: string
  numberOfMessages: number
}): Promise<void> {
  return await new Promise((resolve, reject) => {
    restrictAPICall('/tests/', '/src/')
    // Not for groups
    db.query(
      'UPDATE w2w_meta SET allowed_num_msg = ? WHERE did = ?',
      [numberOfMessages, did],
      async (err: any) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}
