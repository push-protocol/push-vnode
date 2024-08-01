import { SortOrderOptions, SpacesSortByOptions } from '../../enums/chat'
// @ts-ignore
import db from '../../helpers/dbHelper'
import { Inbox, SpaceInbox, UserV2 } from '../../interfaces/chat'
import { getGroupDTO, getLimitedGroupDTO, getSpaceDTO } from '../../services/chatService'
import { fetchChatMembersWithProfile, getGroupsAddressBelongsTo } from './w2w'
export * from './chat-members'
export * from './chat-messages'
export * from './ipfs'
export * from './w2w'
export * from './w2w-meta'

/**
 * @deprecated - use @getChatsPaginationV2 instead
 * Reason - Does not work for groups and does not include pagination
 */
export async function getInbox(did: string): Promise<Inbox[]> {
  const dynamicInput = '%'.concat(did.concat('%'))
  return await new Promise(async (resolve, reject) => {
    db.query(
      `SELECT I.intent, I.intent_sent_by, I.combined_did, I.intent_timestamp, I.threadhash, I.chat_id, J.did, J.wallets, J.profile, J.pgp_pub 
      FROM w2w AS I, w2w_meta As J
      WHERE I.combined_did LIKE ?
      AND admins is NULL
      AND J.did != ?
      AND ((J.did = SUBSTRING_INDEX(I.combined_did,'_',1) AND SUBSTRING_INDEX(I.combined_did,'_',-1) = ?)
      OR (J.did = SUBSTRING_INDEX(I.combined_did,'_',-1) AND SUBSTRING_INDEX(I.combined_did,'_',1) = ?))
      # Filter out groups
      AND I.admins IS NULL
      ORDER BY I.intent_timestamp DESC
      `,
      [dynamicInput, did, did, did],
      async (err, result) => {
        if (err) return reject(err)
        const inbox: Inbox[] = []
        result.map((inbx: any) => {
          let profile = {
            name: null,
            desc: null,
            picture: null,
            profileVerificationProof: null
          }
          try {
            profile = JSON.parse(inbx.profile)
          } catch (e) {
            console.error('Error parsing profile JSON:', e)
          }
          inbox.push({
            chatId: inbx.chat_id,
            about: profile.desc,
            did: inbx.did,
            intent: inbx.intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            publicKey: inbx.pgp_pub,
            profilePicture: profile.picture,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            wallets: inbx.wallets,
            combinedDID: inbx.combined_did,
            name: profile.name
          })
        })

        // Get group information
        const groupInbox = await getGroupsAddressBelongsTo({ address: did, isGroupRequest: false })
        for (const group of groupInbox) {
          inbox.push(group)
        }
        return resolve(inbox)
      }
    )
  })
}

/**
 * @deprecated - use @getChatsPaginationV2 instead
 * Reason - Does not work for groups and does not include pagination
 */
export async function getChats(did: string): Promise<Inbox[]> {
  const dynamicInput = '%'.concat(did.concat('%'))
  return await new Promise(async (resolve, reject) => {
    db.query(
      `SELECT I.intent, I.intent_sent_by, I.combined_did, I.intent_timestamp, I.threadhash, I.chat_id, J.did, J.wallets, J.profile, J.pgp_pub
                          FROM w2w AS I, w2w_meta As J
                          WHERE I.combined_did LIKE ?
                          AND J.did != ?
                          AND ((J.did = SUBSTRING_INDEX(I.combined_did,'_',1) AND SUBSTRING_INDEX(I.combined_did,'_',-1) = ?)
                          OR (J.did = SUBSTRING_INDEX(I.combined_did,'_',-1) AND SUBSTRING_INDEX(I.combined_did,'_',1) = ?))
                          # Filter out groups
                          AND I.admins IS NULL
                          # Filter for chats
                          AND I.intent LIKE ?
                          ORDER BY I.intent_timestamp DESC`,
      [dynamicInput, did, did, did, dynamicInput],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inbox: Inbox[] = []
        result.map((inbx: any) => {
          let profile = {
            name: null,
            desc: null,
            picture: null
          }
          try {
            profile = JSON.parse(inbx.profile)
          } catch (e) {
            console.error('Error parsing profile JSON:', e)
          }
          inbox.push({
            chatId: inbx.chat_id,
            about: profile.desc,
            did: inbx.did,
            intent: inbx.intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            publicKey: inbx.pgp_pub,
            profilePicture: profile.picture,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            wallets: inbx.wallets,
            combinedDID: inbx.combined_did,
            name: profile.name
          })
        })
        const groupInbox = await getGroupsAddressBelongsTo({ address: did, isGroupRequest: false })
        for (const group of groupInbox) {
          inbox.push(group)
        }
        return resolve(inbox)
      }
    )
  })
}

/**
 * @deprecated - use @getChatsPaginationV2 instead
 * Reason - Not Scalable for large groups
 */
export async function getChatsPagination(
  did: string,
  page: number,
  limit: number
): Promise<Inbox[]> {
  const dynamicInput = '%'.concat(did.concat('%'))
  const offset = (page - 1) * limit
  return await new Promise(async (resolve, reject) => {
    db.query(
      `(SELECT 
    I.intent, I.intent_sent_by, I.combined_did, I.intent_timestamp, 
    I.threadhash, I.chat_id, J.did, J.wallets, J.profile, J.pgp_pub 
  FROM 
    w2w AS I, w2w_meta AS J
  WHERE 
    I.combined_did LIKE ? AND   # Get all messages
    J.did != ? AND 
    (
        (J.did = SUBSTRING_INDEX(I.combined_did,'_',1) AND SUBSTRING_INDEX(I.combined_did,'_',-1) = ?) OR 
        (J.did = SUBSTRING_INDEX(I.combined_did,'_',-1) AND SUBSTRING_INDEX(I.combined_did,'_',1) = ?)
    ) AND
    I.admins IS NULL AND # Filter out groups
    I.intent LIKE ?)  # Filter for chats
      UNION
      (SELECT 
          I.intent, I.intent_sent_by, I.combined_did, I.intent_timestamp, 
          I.threadhash, I.chat_id, NULL, NULL, NULL, NULL
      FROM 
          w2w AS I 
      WHERE 
          I.combined_did LIKE ? AND  # Get all messages
          I.group_name IS NOT NULL AND # Filter out groups
          I.admins IS NOT NULL AND # Filter out groups
          (I.group_type = 'default' OR I.group_type IS NULL) AND # Filter out groups
          I.intent LIKE ?)
      ORDER BY 
          intent_timestamp DESC
      LIMIT ? OFFSET ?`,
      [dynamicInput, did, did, did, dynamicInput, dynamicInput, dynamicInput, limit, offset],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inboxPromises: Promise<Inbox>[] = result.map(async (inbx: any) => {
          let profile = {
            name: null,
            desc: null,
            picture: null
          }
          try {
            if (inbx.profile != null) {
              profile = JSON.parse(inbx.profile)
            }
          } catch (e) {
            console.error('Error parsing profile JSON:', e)
          }
          const inboxToBeAdded: Inbox = {
            chatId: inbx.chat_id,
            about: profile.desc,
            did: inbx.did,
            intent: inbx.intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            publicKey: inbx.pgp_pub,
            profilePicture: profile.picture,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            wallets: inbx.wallets,
            combinedDID: inbx.combined_did,
            name: profile.name,
            groupInformation: null
          }

          if (inbx.did === null) {
            inboxToBeAdded.groupInformation = await getGroupDTO(inbx.chat_id)
          }
          return inboxToBeAdded
        })

        const inbox: Inbox[] = await Promise.all(inboxPromises)
        // await all promises to resolve
        return resolve(inbox)
      }
    )
  })
}

export async function getChatsPaginationV2(
  did: string,
  page: number,
  limit: number
): Promise<Inbox[]> {
  const offset = (page - 1) * limit
  return await new Promise(async (resolve, reject) => {
    db.query(
      `
      SELECT
      w2w.chat_id,
      w2w.threadhash,
      w2w.intent_timestamp,
      w2w.intent_sent_by,
      w2w.admins
      FROM (
          SELECT chat_id
          FROM chat_members
          WHERE address = ? AND intent = 1
      ) AS CHATS
      JOIN w2w ON CHATS.chat_id = w2w.chat_id
      WHERE w2w.group_type = 'default' OR w2w.group_type IS NULL
      ORDER BY w2w.intent_timestamp DESC
      LIMIT ? OFFSET ?;
    `,
      [did, limit, offset],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inboxPromises: Promise<Inbox>[] = result.map(async (inbx: any) => {
          const isGroup = inbx.admins != null
          const groupInfo = isGroup ? await getLimitedGroupDTO(inbx.chat_id) : null // 100 members
          let limitedIntent: string = ''
          let limitedCombinedDID: string = ''
          let otherUser: UserV2
          if (isGroup) {
            groupInfo.members.map((member) => {
              limitedIntent = limitedIntent + member.wallet + '+'
              limitedCombinedDID = limitedCombinedDID + member.wallet + '_'
            })
            groupInfo.pendingMembers.map((member) => {
              limitedCombinedDID = limitedCombinedDID + member.wallet + '_'
            })
          } else {
            const chatMembers = await fetchChatMembersWithProfile(inbx.chat_id, 2, 1)
            chatMembers.map((member) => {
              if (member.intent) {
                limitedIntent = limitedIntent + member.address + '+'
              }
              limitedCombinedDID = limitedCombinedDID + member.address + '_'
              if (member.address.toLowerCase() != did.toLowerCase()) {
                otherUser = member.userInfo
              }
            })
          }
          if (limitedIntent.length > 0) {
            limitedIntent = limitedIntent.slice(0, -1)
          }
          if (limitedCombinedDID.length > 0) {
            limitedCombinedDID = limitedCombinedDID.slice(0, -1)
          }
          const intent: string = limitedIntent
          const combinedDID: string = limitedCombinedDID

          const inbox: Inbox = {
            chatId: inbx.chat_id,
            did: isGroup ? null : otherUser.did,
            wallets: isGroup ? null : otherUser.wallets,
            profilePicture: isGroup ? null : otherUser.profile.picture,
            publicKey: isGroup ? null : otherUser.publicKey,
            about: isGroup ? null : otherUser.profile.desc,
            name: isGroup ? null : otherUser.profile.name,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            intent: intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            combinedDID: combinedDID,
            groupInformation: groupInfo
          }
          return inbox
        })
        const inbox: Inbox[] = await Promise.all(inboxPromises)
        return resolve(inbox)
      }
    )
  })
}

/**
 * @deprecated - Use @getRequestsPaginationV2 instead
 * Reason - Does not work for groups and does not include pagination
 */
export async function getRequests(did: string): Promise<Inbox[]> {
  const dynamicInput = '%'.concat(did.concat('%'))
  return await new Promise(async (resolve, reject) => {
    db.query(
      `SELECT I.intent, I.intent_sent_by, I.combined_did, I.intent_timestamp, I.threadhash, I.chat_id, J.did, J.wallets, J.profile, J.pgp_pub FROM w2w AS I, w2w_meta As J
      # Get all messages
      WHERE I.combined_did LIKE ?
      AND J.did != ?
      AND ((J.did = SUBSTRING_INDEX(I.combined_did,'_',1) AND SUBSTRING_INDEX(I.combined_did,'_',-1) = ?)
      OR (J.did = SUBSTRING_INDEX(I.combined_did,'_',-1) AND SUBSTRING_INDEX(I.combined_did,'_',1) = ?))
      # Filter out groups
      AND I.admins IS NULL
      # Filter for requests
      AND I.intent NOT LIKE ?
      ORDER BY I.intent_timestamp DESC`,
      [dynamicInput, did, did, did, dynamicInput],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inbox: Inbox[] = []
        result.map((inbx: any) => {
          let profile = {
            name: null,
            desc: null,
            picture: null
          }
          try {
            profile = JSON.parse(inbx.profile)
          } catch (e) {
            console.error('Error parsing profile JSON:', e)
          }
          inbox.push({
            chatId: inbx.chat_id,
            about: profile.desc,
            did: inbx.did,
            intent: inbx.intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            publicKey: inbx.pgp_pub,
            profilePicture: profile.picture,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            wallets: inbx.wallets,
            combinedDID: inbx.combined_did,
            name: profile.name
          })
        })
        // Get group information
        const groupInbox = await getGroupsAddressBelongsTo({ address: did, isGroupRequest: true })
        for (const group of groupInbox) {
          inbox.push(group)
        }
        return resolve(inbox)
      }
    )
  })
}

/**
 * @deprecated - use @getRequestsPaginationV2 instead
 * Reason - Not Scalable for large groups
 */
export async function getRequestsPagination(
  did: string,
  page: number,
  limit: number
): Promise<Inbox[]> {
  const dynamicInput = '%'.concat(did.concat('%'))
  const offset = (page - 1) * limit
  return await new Promise(async (resolve, reject) => {
    db.query(
      `(SELECT 
    I.intent, I.intent_sent_by, I.combined_did, I.intent_timestamp, 
    I.threadhash, I.chat_id, J.did, J.wallets, J.profile, J.pgp_pub 
  FROM 
    w2w AS I, w2w_meta AS J
  WHERE 
    I.combined_did LIKE ? AND   # Get all messages
    J.did != ? AND 
    (
        (J.did = SUBSTRING_INDEX(I.combined_did,'_',1) AND SUBSTRING_INDEX(I.combined_did,'_',-1) = ?) OR 
        (J.did = SUBSTRING_INDEX(I.combined_did,'_',-1) AND SUBSTRING_INDEX(I.combined_did,'_',1) = ?)
    ) AND
    I.admins IS NULL AND # Filter out groups
    I.intent NOT LIKE ?)  # Filter for requests
      UNION
      (SELECT 
          I.intent, I.intent_sent_by, I.combined_did, I.intent_timestamp, 
          I.threadhash, I.chat_id, NULL, NULL, NULL, NULL
      FROM 
          w2w AS I 
      WHERE 
          I.combined_did LIKE ? AND  # Get all messages
          I.group_name IS NOT NULL AND # Filter out groups
          I.admins IS NOT NULL AND # Filter out groups
          (I.group_type = 'default' OR I.group_type IS NULL) AND # Filter out groups
          I.intent NOT LIKE ?)
      ORDER BY 
          intent_timestamp DESC
      LIMIT ? OFFSET ?`,
      [dynamicInput, did, did, did, dynamicInput, dynamicInput, dynamicInput, limit, offset],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inboxPromises: Promise<Inbox>[] = result.map(async (inbx: any) => {
          let profile = {
            name: null,
            desc: null,
            picture: null
          }
          try {
            if (inbx.profile != null) {
              profile = JSON.parse(inbx.profile)
            }
          } catch (e) {
            console.error('Error parsing profile JSON:', e)
          }

          const inboxToBeAdded: Inbox = {
            chatId: inbx.chat_id,
            about: profile.desc,
            did: inbx.did,
            intent: inbx.intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            publicKey: inbx.pgp_pub,
            profilePicture: profile.picture,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            wallets: inbx.wallets,
            combinedDID: inbx.combined_did,
            name: profile.name,
            groupInformation: null
          }

          if (inbx.did === null) {
            inboxToBeAdded.groupInformation = await getGroupDTO(inbx.chat_id)
          }
          return inboxToBeAdded
        })

        const inbox: Inbox[] = await Promise.all(inboxPromises)
        return resolve(inbox)
      }
    )
  })
}

export async function getRequestsPaginationV2(
  did: string,
  page: number,
  limit: number
): Promise<Inbox[]> {
  const offset = (page - 1) * limit
  return await new Promise(async (resolve, reject) => {
    db.query(
      `
      SELECT
      w2w.chat_id,
      w2w.threadhash,
      w2w.intent_timestamp,
      w2w.intent_sent_by,
      w2w.admins
      FROM (
          SELECT chat_id
          FROM chat_members
          WHERE address = ? AND intent = 0
      ) AS CHATS
      JOIN w2w ON CHATS.chat_id = w2w.chat_id
      WHERE w2w.group_type = 'default' OR w2w.group_type IS NULL
      ORDER BY w2w.intent_timestamp DESC
      LIMIT ? OFFSET ?;
    `,
      [did, limit, offset],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inboxPromises: Promise<Inbox>[] = result.map(async (inbx: any) => {
          const isGroup = inbx.admins != null
          const groupInfo = isGroup ? await getLimitedGroupDTO(inbx.chat_id) : null // 100 members
          let limitedIntent: string = ''
          let limitedCombinedDID: string = ''
          let otherUser: UserV2
          if (isGroup) {
            groupInfo.members.map((member) => {
              limitedIntent = limitedIntent + member.wallet + '+'
              limitedCombinedDID = limitedCombinedDID + member.wallet + '_'
            })
            groupInfo.pendingMembers.map((member) => {
              limitedCombinedDID = limitedCombinedDID + member.wallet + '_'
            })
          } else {
            const chatMembers = await fetchChatMembersWithProfile(inbx.chat_id, 2, 1)
            chatMembers.map((member) => {
              if (member.intent) {
                limitedIntent = limitedIntent + member.address + '+'
              }
              limitedCombinedDID = limitedCombinedDID + member.address + '_'
              if (member.address.toLowerCase() != did.toLowerCase()) {
                otherUser = member.userInfo
              }
            })
          }
          if (limitedIntent.length > 0) {
            limitedIntent = limitedIntent.slice(0, -1)
          }
          if (limitedCombinedDID.length > 0) {
            limitedCombinedDID = limitedCombinedDID.slice(0, -1)
          }
          const intent: string = limitedIntent
          const combinedDID: string = limitedCombinedDID

          const inbox: Inbox = {
            chatId: inbx.chat_id,
            did: isGroup ? null : otherUser.did,
            wallets: isGroup ? null : otherUser.wallets,
            profilePicture: isGroup ? null : otherUser.profile.picture,
            publicKey: isGroup ? null : otherUser.publicKey,
            about: isGroup ? null : otherUser.profile.desc,
            name: isGroup ? null : otherUser.profile.name,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            intent: intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            combinedDID: combinedDID,
            groupInformation: groupInfo
          }
          return inbox
        })
        const inbox: Inbox[] = await Promise.all(inboxPromises)
        return resolve(inbox)
      }
    )
  })
}
/**
 * @deprecated - use @getSpacesPaginationV2 instead
 * Reason - Not Scalable for large spaces
 */
export async function getSpacesPagination(
  did: string,
  page: number,
  limit: number
): Promise<SpaceInbox[]> {
  const dynamicInput = '%'.concat(did.concat('%'))
  const offset = (page - 1) * limit
  return await new Promise(async (resolve, reject) => {
    db.query(
      `SELECT 
          I.intent, I.intent_sent_by, I.combined_did, I.intent_timestamp, 
          I.threadhash, I.chat_id, NULL, NULL, NULL, NULL
      FROM 
          w2w AS I 
      WHERE 
          I.combined_did LIKE ? AND  # Get all messages
          I.group_type = 'spaces' AND # Filter out spaces
          I.intent LIKE ?
      ORDER BY 
          intent_timestamp DESC
      LIMIT ? OFFSET ?`,
      [dynamicInput, dynamicInput, limit, offset],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inboxPromises: Promise<SpaceInbox>[] = result.map(async (inbx: any) => {
          const profile = {
            name: null,
            desc: null,
            picture: null
          }
          const inboxToBeAdded: SpaceInbox = {
            spaceId: inbx.chat_id,
            about: profile.desc,
            did: null,
            intent: inbx.intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            publicKey: null,
            profilePicture: profile.picture,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            wallets: null,
            combinedDID: inbx.combined_did,
            name: profile.name,
            spaceInformation: null
          }

          inboxToBeAdded.spaceInformation = await getSpaceDTO(inbx.chat_id)
          return inboxToBeAdded
        })

        const inbox: SpaceInbox[] = await Promise.all(inboxPromises)
        return resolve(inbox)
      }
    )
  })
}

export async function getSpacesPaginationV2(
  did: string,
  page: number,
  limit: number
): Promise<SpaceInbox[]> {
  const offset = (page - 1) * limit
  return await new Promise(async (resolve, reject) => {
    db.query(
      `
      SELECT w2w.chat_id, w2w.threadhash, w2w.intent_timestamp, w2w.intent_sent_by

      # Get all chats for user sorted by intent sent timestamp 
      FROM (
        SELECT chat_id
        FROM chat_members
        WHERE address = ? AND intent = 1
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      ) AS CHATS
      JOIN w2w ON CHATS.chat_id = w2w.chat_id
      WHERE w2w.group_type = 'spaces';
    `,
      [did, limit, offset],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inboxPromises: Promise<SpaceInbox>[] = result.map(async (inbx: any) => {
          // TODO: Implement getSpaceProfileDTO
          const spaceInfo = await getSpaceDTO(inbx.chat_id)
          const inbox: SpaceInbox = {
            spaceId: inbx.chat_id,
            about: null,
            did: null,
            intent: inbx.intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            publicKey: null,
            profilePicture: null,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            wallets: null,
            combinedDID: inbx.combined_did,
            name: null,
            spaceInformation: spaceInfo
          }
          return inbox
        })
        const inbox: SpaceInbox[] = await Promise.all(inboxPromises)
        return resolve(inbox)
      }
    )
  })
}
/**
 * @deprecated - use @getSpacesRequestsPaginationV2 instead
 * Reason - Not Scalable for large spaces
 */
export async function getSpacesRequestsPagination(
  did: string,
  page: number,
  limit: number
): Promise<SpaceInbox[]> {
  const dynamicInput = '%'.concat(did.concat('%'))
  const offset = (page - 1) * limit
  return await new Promise(async (resolve, reject) => {
    db.query(
      `SELECT 
          I.intent, I.intent_sent_by, I.combined_did, I.intent_timestamp, 
          I.threadhash, I.chat_id, NULL, NULL, NULL, NULL
      FROM 
          w2w AS I 
      WHERE 
          I.combined_did LIKE ? AND  # Get all messages
          I.group_type = 'spaces' AND # Filter out spaces
          I.intent NOT LIKE ?
      ORDER BY 
          intent_timestamp DESC
      LIMIT ? OFFSET ?`,
      [dynamicInput, dynamicInput, limit, offset],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inboxPromises: Promise<SpaceInbox>[] = result.map(async (inbx: any) => {
          const profile = {
            name: null,
            desc: null,
            picture: null
          }
          const inboxToBeAdded: SpaceInbox = {
            spaceId: inbx.chat_id,
            about: profile.desc,
            did: null,
            intent: inbx.intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            publicKey: null,
            profilePicture: profile.picture,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            wallets: null,
            combinedDID: inbx.combined_did,
            name: profile.name,
            spaceInformation: null
          }

          inboxToBeAdded.spaceInformation = await getSpaceDTO(inbx.chat_id)
          return inboxToBeAdded
        })

        const inbox: SpaceInbox[] = await Promise.all(inboxPromises)
        return resolve(inbox)
      }
    )
  })
}

export async function getSpacesRequestsPaginationV2(
  did: string,
  page: number,
  limit: number
): Promise<SpaceInbox[]> {
  const offset = (page - 1) * limit
  return await new Promise(async (resolve, reject) => {
    db.query(
      `
      SELECT w2w.chat_id, w2w.threadhash, w2w.intent_timestamp, w2w.intent_sent_by

      # Get all chats for user sorted by intent sent timestamp 
      FROM (
        SELECT chat_id
        FROM chat_members
        WHERE address = ? AND intent = 0
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      ) AS CHATS
      JOIN w2w ON CHATS.chat_id = w2w.chat_id
      WHERE w2w.group_type = 'spaces';
    `,
      [did, limit, offset],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inboxPromises: Promise<SpaceInbox>[] = result.map(async (inbx: any) => {
          // TODO: Implement getSpaceProfileDTO
          const spaceInfo = await getSpaceDTO(inbx.chat_id)
          const inbox: SpaceInbox = {
            spaceId: inbx.chat_id,
            about: null,
            did: null,
            intent: inbx.intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            publicKey: null,
            profilePicture: null,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            wallets: null,
            combinedDID: inbx.combined_did,
            name: null,
            spaceInformation: spaceInfo
          }
          return inbox
        })
        const inbox: SpaceInbox[] = await Promise.all(inboxPromises)
        return resolve(inbox)
      }
    )
  })
}

export async function getTrendingSpacesPagination(
  page: number,
  limit: number,
  sortBy: SpacesSortByOptions = SpacesSortByOptions.MEMBERS,
  sortOrder: SortOrderOptions = SortOrderOptions.DESC
): Promise<SpaceInbox[]> {
  const offset = (page - 1) * limit

  let sortString
  switch (sortBy) {
    case SpacesSortByOptions.TIMESTAMP:
      sortString = `I.intent_timestamp ${sortOrder}`
      break
    case SpacesSortByOptions.MEMBERS:
    default:
      sortString = `(LENGTH(I.combined_did) - LENGTH(REPLACE(I.combined_did, '_', ''))) + 1 ${sortOrder}`
      break
  }

  return await new Promise(async (resolve, reject) => {
    db.query(
      `SELECT 
          I.intent, I.intent_sent_by, I.combined_did, I.intent_timestamp, 
          I.threadhash, I.chat_id, NULL, NULL, NULL, NULL
      FROM 
          w2w AS I 
      WHERE 
          I.group_type = 'spaces' AND # Filter for spaces
          I.is_public = 1 AND # Filter only public groups
          ((I.schedule_at > NOW() AND I.status != 'ENDED') OR (I.schedule_at <= NOW() AND I.status = 'PENDING')) # Fetch upcoming or pending spaces
      ORDER BY 
          ${sortString}
      LIMIT ? OFFSET ?`,
      [limit, offset],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve([])
        }
        const inboxPromises: Promise<SpaceInbox>[] = result.map(async (inbx: any) => {
          const profile = {
            name: null,
            desc: null,
            picture: null
          }
          const inboxToBeAdded: SpaceInbox = {
            spaceId: inbx.chat_id,
            about: profile.desc,
            did: null,
            intent: inbx.intent,
            intentSentBy: inbx.intent_sent_by,
            intentTimestamp: inbx.intent_timestamp,
            publicKey: null,
            profilePicture: profile.picture,
            threadhash:
              inbx.threadhash == null || inbx.threadhash.length == 0 ? null : inbx.threadhash,
            wallets: null,
            combinedDID: inbx.combined_did,
            name: profile.name,
            spaceInformation: null
          }

          inboxToBeAdded.spaceInformation = await getSpaceDTO(inbx.chat_id)
          return inboxToBeAdded
        })

        const inbox: SpaceInbox[] = await Promise.all(inboxPromises)
        return resolve(inbox)
      }
    )
  })
}

export async function getSingleThreadHash(
  fromDid: string,
  toDid: string,
  isGroup: boolean
): Promise<{ threadHash: string; intent: boolean } | null> {
  return await new Promise(async (resolve, reject) => {
    if (isGroup) {
      // Query for group chat
      db.query(`SELECT threadhash FROM w2w WHERE chat_id = ?`, [toDid], (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) {
          return resolve({ threadHash: null, intent: false })
        }

        // Query for intent in group chat
        db.query(
          `SELECT intent FROM chat_members WHERE chat_id = ? AND address = ?`,
          [toDid, fromDid],
          (intentErr, intentResult) => {
            if (intentErr) return reject(intentErr)
            const intent = intentResult.length > 0 && intentResult[0].intent
            return resolve({ threadHash: result[0].threadhash, intent: !!intent })
          }
        )
      })
    } else {
      // Query for non-group chat
      db.query(
        `SELECT threadhash, intent FROM w2w 
         WHERE (combined_did = ? OR combined_did = ?)
         AND group_name IS NULL`,
        [`${toDid}_${fromDid}`, `${fromDid}_${toDid}`],
        (err, result) => {
          if (err) return reject(err)
          if (result.length === 0) {
            return resolve({ threadHash: null, intent: false })
          }

          // Determine if intent is true for non-group chat
          const isIntentTrue =
            result[0].intent === `${toDid}+${fromDid}` || result[0].intent === `${fromDid}+${toDid}`
          return resolve({ threadHash: result[0].threadhash, intent: isIntentTrue })
        }
      )
    }
  })
}

export async function addToSpaceWaitlist(wallet: string): Promise<boolean | null> {
  return await new Promise(async (resolve, reject) => {
    try {
      db.query(
        `INSERT INTO spaces_waitlist (email) 
        VALUES (?)`,
        [wallet],
        (err) => {
          if (err) return reject(err)
          return resolve(true)
        }
      )
    } catch (error) {
      return reject(false)
    }
  })
}
