import { restrictAPICall } from '../../helpers/restrictAPICallHelper'
import { EncryptionKeys, User, UserV2, W2WMeta } from '../../interfaces/chat'
const db = require('../../helpers/dbHelper')
import { isValidNFTAddressV2 } from '../../helpers/chatHelper'

const ENC_TYPE_V2 = 'aes256GcmHkdfSha256'
const ENC_TYPE_V3 = 'eip191-aes256-gcm-hkdf-sha256'
const ENC_TYPE_V4 = 'pgpv1:nft'

export function getPgpEncType(encryptedPrivateKey) {
  let pgpEncType = ''

  if (encryptedPrivateKey) {
    try {
      const pgpPrivEncJson = JSON.parse(encryptedPrivateKey)
      pgpEncType = pgpPrivEncJson.version
    } catch (err) {
      pgpEncType = ''
    }
  }
  return pgpEncType
}

export function parseUserPublicKey(encryptedPrivateKey: string, publicKey: string): string {
  const pgpEncType = getPgpEncType(encryptedPrivateKey)
  let publicKeyArmored: string
  if (pgpEncType === ENC_TYPE_V2 || pgpEncType === ENC_TYPE_V3 || pgpEncType === ENC_TYPE_V4) {
    publicKeyArmored = JSON.parse(publicKey).key
  } else {
    publicKeyArmored = publicKey
  }
  return publicKeyArmored
}

export async function getPublicKeyEncryptedPrivateKey(DID: string): Promise<EncryptionKeys | null> {
  return await new Promise((resolve, reject) => {
    db.query('SELECT pgp_pub, pgp_priv_enc FROM w2w_meta WHERE did=?', DID, async (err, result) => {
      if (err) return reject(err)
      if (result.length === 0) return resolve(null)
      const pgpEncType = getPgpEncType(result[0].pgp_priv_enc)
      return resolve({
        publicKeyArmored:
          pgpEncType === ENC_TYPE_V2 || pgpEncType === ENC_TYPE_V3 || pgpEncType === ENC_TYPE_V4
            ? JSON.parse(result[0].pgp_pub).key
            : result[0].pgp_pub,
        encryptedPrivateKey: result[0].pgp_priv_enc
      })
    })
  })
}

export async function getW2WMeta(DID: string): Promise<W2WMeta | null> {
  return await new Promise((resolve, reject) => {
    db.query(
      'SELECT pgp_pub, pgp_priv_enc, num_msg, allowed_num_msg FROM w2w_meta WHERE did=?',
      DID,
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) return resolve(null)
        const pgpEncType = getPgpEncType(result[0].pgp_priv_enc)
        return resolve({
          publicKeyArmored:
            pgpEncType === ENC_TYPE_V2 || pgpEncType === ENC_TYPE_V3 || pgpEncType === ENC_TYPE_V4
              ? JSON.parse(result[0].pgp_pub).key
              : result[0].pgp_pub,
          encryptedPrivateKey: result[0].pgp_priv_enc,
          messagesSent: result.at(-1).num_msg,
          messagesMax: result.at(-1).allowed_num_msg
        })
      }
    )
  })
}

export async function updateName({ name, did }: { name: string; did: string }): Promise<void> {
  return await new Promise((resolve, reject) => {
    db.query(`UPDATE w2w_meta SET name = ? WHERE did = ?`, [name, did], async (err: any) => {
      if (err) {
        return reject(err)
      }
      return resolve()
    })
  })
}

export async function getNumberMessagesSent(
  DID: string
): Promise<{ messagesSent: number; messagesMax: number }> {
  return await new Promise((resolve, reject) => {
    db.query(
      'SELECT num_msg, allowed_num_msg FROM w2w_meta WHERE did=?',
      DID,
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) return resolve(null)
        return resolve({
          messagesSent: result.at(-1).num_msg,
          messagesMax: result.at(-1).allowed_num_msg
        })
      }
    )
  })
}

export async function updateMessagesSent(updateStorage: number, DID: string): Promise<void> {
  return await new Promise((resolve, reject) => {
    db.query(
      'UPDATE w2w_meta SET num_msg = num_msg + ? WHERE did=?',
      [updateStorage, DID],
      async (err, _) => {
        if (err) return reject(err)
        return resolve()
      }
    )
  })
}

export async function deleteW2WRecordById(id: number): Promise<void> {
  const deleteQuery = 'DELETE FROM w2w WHERE id = ? LIMIT 1'

  return new Promise((resolve, reject) => {
    db.query(deleteQuery, [id], (err: any, _results: any) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

// TODO: Usage and columns of pgp_enc_type, signature, sig_type tp be removed.
export async function createUser(user: User): Promise<void> {
  return await new Promise(async (resolve, reject) => {
    const verificationProof =
      user.signature && user.sigType ? `${user.sigType}:${user.signature}` : null

    const profile = {
      name: user.name,
      desc: user.about,
      picture: user.profilePicture,
      blockedUsersList: [],
      profileVerificationProof: null
    }

    let updatedEncryptedPrivateKey = user.encryptedPrivateKey
    if (user.nftOwner) {
      let encryptedPrivateKeyJSON
      try {
        encryptedPrivateKeyJSON = JSON.parse(user.encryptedPrivateKey)
        encryptedPrivateKeyJSON.owner = user.nftOwner
        updatedEncryptedPrivateKey = JSON.stringify(encryptedPrivateKeyJSON)
      } catch (error) {
        // If user.encryptedPrivateKey isn't valid JSON, nothing happens here and the action is skipped.
      }
    }

    db.query(
      `INSERT INTO w2w_meta (did, wallets, profile, pgp_pub, pgp_priv_enc, verification_proof, num_msg, allowed_num_msg, pgp_enc_type, signature, sig_type, origin) 
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        user.did,
        user.wallets,
        JSON.stringify(profile),
        user.publicKey,
        updatedEncryptedPrivateKey,
        verificationProof,
        user.numMsg,
        user.allowedNumMsg,
        '',
        '',
        '',
        user.origin
      ],
      (err) => {
        if (err) {
          return reject(err)
        }
        return resolve()
      }
    )
  })
}

export async function updateUser({
  did,
  publicKey,
  encryptedPrivateKey,
  nftOwner,
  signature,
  sigType,
  profile
}: {
  did: string
  publicKey: string
  encryptedPrivateKey: string
  nftOwner: string
  signature: string
  sigType: string
  profile: {
    name: string
    desc: string
    picture: string
    blockedUsersList: Array<string>
    profileVerificationProof: string
  }
}): Promise<User> {
  return await new Promise(async (resolve, reject) => {
    const verificationProof = signature && sigType ? `${sigType}:${signature}` : null

    let updatedEncryptedPrivateKey = encryptedPrivateKey
    if (nftOwner) {
      let encryptedPrivateKeyJSON
      try {
        encryptedPrivateKeyJSON = JSON.parse(encryptedPrivateKey)
        encryptedPrivateKeyJSON.owner = nftOwner
        updatedEncryptedPrivateKey = JSON.stringify(encryptedPrivateKeyJSON)
      } catch (error) {
        // If encryptedPrivateKey isn't valid JSON, nothing happens here and the action is skipped.
      }
    }

    db.query(
      'UPDATE w2w_meta SET did = ?, pgp_pub = ?, pgp_priv_enc = ?,  verification_proof = ?, profile = ? WHERE did = ?',
      [did, publicKey, updatedEncryptedPrivateKey, verificationProof, JSON.stringify(profile), did],
      async (err, result) => {
        if (err) {
          return reject(err)
        }
        const user: User = await getUser(did)
        return resolve(user)
      }
    )
  })
}

export async function updateUserProfile({
  did,
  profile
}: {
  did: string
  profile: {
    name: string
    desc: string
    picture: string
    blockedUsersList: Array<string>
    profileVerificationProof: string
  }
}): Promise<UserV2> {
  return await new Promise(async (resolve, reject) => {
    db.query(
      'UPDATE w2w_meta SET profile = ? WHERE did = ?',
      [JSON.stringify(profile), did],
      async (err, result) => {
        if (err) {
          return reject(err)
        }
        const user: UserV2 = await getUserV2(did)
        return resolve(user)
      }
    )
  })
}

// This function checks which DIDs exist in the w2w_meta table and returns them
export async function getExistingUserDIDs(dids: string[]): Promise<Set<string>> {
  if (dids.length === 0) {
    return new Set<string>() // Explicitly declare the Set as containing strings
  }

  const placeholders = dids.map(() => '?').join(',')
  const query = `
    SELECT did FROM w2w_meta WHERE did IN (${placeholders});
  `

  return new Promise<Set<string>>((resolve, reject) => {
    db.query(query, dids, (err, results: { did: string }[]) => {
      // Provide a type for results
      if (err) {
        return reject(err)
      }
      const existingDIDs = new Set<string>(results.map((result) => result.did))
      resolve(existingDIDs)
    })
  })
}

export async function getUser(DID: string): Promise<User> {
  if (isValidNFTAddressV2(DID)) {
    return await getNFTUser(DID)
  } else {
    return await new Promise(async (resolve, reject) => {
      db.query(
        'SELECT wallets, profile, did, pgp_pub, pgp_priv_enc, allowed_num_msg, num_msg, verification_proof, origin FROM w2w_meta WHERE did=?',
        [DID],
        async (err, result) => {
          if (err) {
            return reject(err)
          }
          if (result.length === 0) {
            return resolve(null)
          } else {
            const pgpEncType = getPgpEncType(result[0].pgp_priv_enc)
            const verificationProof = result[0].verification_proof
            const [sigType, signature] = verificationProof
              ? verificationProof.split(':')
              : [null, null]
            const profile = result[0].profile ? JSON.parse(result[0].profile) : {}

            let owner = null
            const encryptedPrivateKey = result[0].pgp_priv_enc

            try {
              const encryptedPrivateKeyObj = JSON.parse(encryptedPrivateKey)
              if (encryptedPrivateKeyObj.owner) {
                owner = encryptedPrivateKeyObj.owner
              }
            } catch (error) {
              // encryptedPrivateKey is not a JSON string, do nothing
            }

            const user: User = {
              about: profile.desc,
              name: profile.name,
              allowedNumMsg: result[0].allowed_num_msg,
              did: result[0].did,
              encryptedPrivateKey: result[0].pgp_priv_enc,
              encryptionType: pgpEncType,
              encryptedPassword: null,
              nftOwner: owner,
              numMsg: result[0].num_msg,
              profilePicture: profile.picture,
              publicKey: result[0].pgp_pub,
              sigType: sigType,
              signature: signature,
              wallets: result[0].wallets,
              linkedListHash: null,
              origin: result[0].origin
            }
            return resolve(user)
          }
        }
      )
    })
  }
}

export async function getUserV2(DID: string): Promise<UserV2> {
  if (isValidNFTAddressV2(DID)) {
    return await getNFTUserV2(DID)
  } else {
    return await new Promise(async (resolve, reject) => {
      db.query(
        'SELECT wallets, profile, did, pgp_pub, pgp_priv_enc, allowed_num_msg, num_msg, verification_proof, origin FROM w2w_meta WHERE did=?',
        [DID],
        async (err, result) => {
          if (err) {
            return reject(err)
          }
          if (result.length === 0) {
            return resolve(null)
          } else {
            const profile = result[0].profile ? JSON.parse(result[0].profile) : {}
            const user: UserV2 = {
              did: result[0].did,
              wallets: result[0].wallets,
              publicKey: result[0].pgp_pub,
              encryptedPrivateKey: result[0].pgp_priv_enc,
              verificationProof: result[0].verification_proof,
              msgSent: result[0].num_msg,
              maxMsgPersisted: result[0].allowed_num_msg,
              profile: profile,
              origin: result[0].origin
            }
            return resolve(user)
          }
        }
      )
    })
  }
}

export async function getNFTUser(address: string): Promise<User> {
  return await new Promise(async (resolve, reject) => {
    const DID = address.split(':')[3]
    db.query(
      'SELECT wallets, profile, did, pgp_pub, pgp_priv_enc, allowed_num_msg, num_msg, linked_list_hash, verification_proof, origin FROM w2w_meta WHERE did LIKE ? ORDER BY CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(did, ":", -1), "_", 1) AS UNSIGNED) DESC LIMIT 1',
      [`${DID}:%`],
      async (err, result) => {
        if (err) {
          return reject(err)
        }
        if (result.length === 0) {
          return resolve(null)
        } else {
          const pgpEncType = getPgpEncType(result[0].pgp_priv_enc)
          const verificationProof = result[0].verification_proof
          const [sigType, signature] = verificationProof
            ? verificationProof.split(':')
            : [null, null]
          const profile = result[0].profile ? JSON.parse(result[0].profile) : {}

          let owner = null
          const encryptedPrivateKey = result[0].pgp_priv_enc

          try {
            const encryptedPrivateKeyObj = JSON.parse(encryptedPrivateKey)
            if (encryptedPrivateKeyObj.owner) {
              owner = encryptedPrivateKeyObj.owner
            }
          } catch (error) {
            // encryptedPrivateKey is not a JSON string, do nothing
          }

          const user: User = {
            about: profile.desc,
            name: profile.name,
            allowedNumMsg: result[0].allowed_num_msg,
            did: result[0].did,
            encryptedPrivateKey: result[0].pgp_priv_enc,
            encryptionType: pgpEncType,
            encryptedPassword: null,
            nftOwner: owner,
            numMsg: result[0].num_msg,
            profilePicture: profile.picture,
            publicKey: result[0].pgp_pub,
            sigType: sigType,
            signature: signature,
            wallets: result[0].wallets,
            linkedListHash: null,
            origin: result[0].origin
          }
          return resolve(user)
        }
      }
    )
  })
}

export async function getNFTUserV2(address: string): Promise<UserV2> {
  return await new Promise(async (resolve, reject) => {
    const DID = address.split(':').splice(0, 5).join(':')
    db.query(
      'SELECT wallets, profile, did, pgp_pub, pgp_priv_enc, allowed_num_msg, num_msg, verification_proof, origin FROM w2w_meta WHERE did LIKE ? ORDER BY CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(did, ":", -1), "_", 1) AS UNSIGNED) DESC LIMIT 1',
      [`${DID}:%`],
      async (err, result) => {
        if (err) {
          return reject(err)
        }
        if (result.length === 0) {
          return resolve(null)
        } else {
          const profile = result[0].profile ? JSON.parse(result[0].profile) : {}
          const user: UserV2 = {
            did: result[0].did,
            wallets: result[0].wallets,
            publicKey: result[0].pgp_pub,
            encryptedPrivateKey: result[0].pgp_priv_enc,
            verificationProof: result[0].verification_proof,
            msgSent: result[0].num_msg,
            maxMsgPersisted: result[0].allowed_num_msg,
            profile: profile,
            origin: result[0].origin
          }
          return resolve(user)
        }
      }
    )
  })
}

export async function getDidFromWallet(wallet: string): Promise<string | null> {
  if (isValidNFTAddressV2(wallet)) {
    return await getNFTDidFromWallet(wallet)
  } else {
    return await new Promise(async (resolve, reject) => {
      wallet = '%'.concat(wallet.concat('%'))
      db.query('SELECT did FROM w2w_meta WHERE wallets LIKE ?', [wallet], async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) return resolve(null)
        return resolve(result[0].did)
      })
    })
  }
}

export async function getNFTDidFromWallet(wallet: string): Promise<string | null> {
  return await new Promise(async (resolve, reject) => {
    db.query(
      'SELECT did FROM w2w_meta WHERE wallets LIKE ? ORDER BY CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(did, ":", -1), "_", 1) AS UNSIGNED) DESC LIMIT 1',
      [`${wallet}:%`],
      async (err, result) => {
        if (err) return reject(err)
        if (result.length === 0) return resolve(null)
        return resolve(result[0].did)
      }
    )
  })
}

export async function addWallet(DID: string, wallet: string): Promise<void> {
  wallet = ',' + wallet
  return await new Promise(async (resolve, reject) => {
    db.query(
      'UPDATE w2w_meta SET wallets = CONCAT(wallets ,?) WHERE did = ?',
      [wallet, DID],
      async (err, result) => {
        if (err) {
          reject(err)
        }
        return resolve()
      }
    )
  })
}

export async function getCAIP10Addresses(): Promise<string[]> {
  return await new Promise((resolve, reject) => {
    db.query('SELECT wallets FROM w2w_meta', async (err, result) => {
      if (err) return reject(err)
      return resolve(result.map((obj: { wallets: string }) => obj.wallets))
    })
  })
}

export async function getTotalUsers(): Promise<number> {
  return await new Promise((resolve, reject) => {
    db.query(
      "SELECT COUNT(did) FROM `w2w_meta` WHERE pgp_pub LIKE '%-----BEGIN PGP PUBLIC KEY BLOCK-----%'",
      async (err, result) => {
        if (err) return reject(err)
        return resolve(result[0]['COUNT(did)'])
      }
    )
  })
}

// What this query is doing is comparing the difference of string between having a `,` and without it
// It's possible for a wallet to have sent only one message and the count of the `,` is 0. So the query must take that into account
export async function getTotalMessages(): Promise<number> {
  return await new Promise((resolve, reject) => {
    db.query('SELECT SUM(num_msg) from w2w_meta', async (err, result) => {
      if (err) return reject(err)
      return resolve(result[0]['SUM(num_msg)'])
    })
  })
}

export async function markSpacesEndedAfterSixHours(): Promise<void> {
  return await new Promise((resolve, reject) => {
    db.query(
      `UPDATE w2w SET status = 'ENDED' WHERE group_type = 'spaces' AND status = 'ACTIVE' AND schedule_at <= DATE_SUB(NOW(), INTERVAL 6 HOUR)`,
      [],
      async (err, result) => {
        if (err) return reject(err)
        return resolve(result)
      }
    )
  })
}

export async function endPendingSpacesAfterSixHours(): Promise<void> {
  return await new Promise((resolve, reject) => {
    db.query(
      `UPDATE w2w SET status = 'ENDED' WHERE group_type = 'spaces' AND status = 'PENDING' AND schedule_at <= DATE_SUB(NOW(), INTERVAL 6 HOUR)`,
      [],
      async (err, result) => {
        if (err) return reject(err)
        return resolve(result)
      }
    )
  })
}

export async function getChatStatus(
  chatId: string,
  addressId: string
): Promise<{
  meta: {
    encrypted: boolean
    group: boolean
    groupInfo?: { public: boolean }
    recipients?: { participantId: string; pushUser: boolean }[] | ['*']
    visibility: boolean
  }
  list: string
  chatId: string
  participants: string[]
} | null> {
  return new Promise(async (resolve, reject) => {
    db.query(
      `SELECT group_name, combined_did, intent, is_public FROM w2w WHERE chat_id = ?`,
      [chatId],
      async (err, w2wResult) => {
        if (err) return reject(err)
        if (w2wResult.length === 0) {
          return resolve(null)
        }

        const chat = w2wResult[0]
        const isGroup = !!chat.group_name
        const encrypted = !chat.is_public

        if (isGroup) {
          db.query(
            `SELECT intent FROM chat_members WHERE chat_id = ? AND address = ?`,
            [chatId, addressId],
            async (intentErr, intentResult) => {
              if (intentErr) return reject(intentErr)
              if (intentResult.length === 0) {
                const visibility = !encrypted // If not encrypted, visibility is true.
                return resolve({
                  meta: {
                    group: true,
                    groupInfo: { public: !!chat.is_public },
                    encrypted: encrypted,
                    recipients: [],
                    visibility: visibility
                  },
                  list: 'UNINITIALIZED',
                  chatId: chatId,
                  participants: ['*']
                })
              }

              const intent = !!intentResult[0].intent
              const list = intent ? 'CHATS' : 'REQUESTS'
              const visibility = list === 'CHATS' // For group, visibility true if list is CHATS.
              return resolve({
                meta: {
                  group: true,
                  groupInfo: { public: !!chat.is_public },
                  encrypted: encrypted,
                  recipients: ['*'],
                  visibility: visibility
                },
                list: list,
                chatId: chatId,
                participants: ['*']
              })
            }
          )
        } else {
          const isInCombinedDID = chat.combined_did.includes(addressId)
          let listStatus = 'UNINITIALIZED'
          const participants = chat.combined_did.split('_')
          if (isInCombinedDID) {
            listStatus = chat.intent.toLowerCase().includes(addressId.toLowerCase())
              ? 'CHATS'
              : 'REQUESTS'
          }
          const participantInfo = await fetchParticipants(chat.combined_did)
          const recipient = participants.find(
            (participant) => participant.toLowerCase() !== addressId.toLowerCase()
          )
          const recipientInfo = participantInfo.find(
            (info) => info.participantId.toLowerCase() === recipient.toLowerCase()
          )
          const encryption = recipientInfo ? recipientInfo.pushUser : false
          const visibility = listStatus === 'CHATS' || listStatus === 'REQUESTS' // For individual chats, visibility true if in CHATS or REQUESTS.

          return resolve({
            meta: {
              group: false,
              groupInfo: null,
              recipients: participantInfo,
              encrypted: encryption,
              visibility: visibility
            },
            list: listStatus,
            chatId: chatId,
            participants: participants
          })
        }
      }
    )
  })
}

export async function fetchParticipants(
  combinedDID: string
): Promise<{ participantId: string; pushUser: boolean }[]> {
  if (!combinedDID) {
    return []
  }

  const participants = combinedDID.split('_')
  return await new Promise<{ participantId: string; pushUser: boolean }[]>((resolve, reject) => {
    Promise.all(
      participants.map(
        (participantId) =>
          new Promise<{ participantId: string; pushUser: boolean }>((innerResolve, innerReject) => {
            db.query(`SELECT did FROM w2w_meta WHERE did = ?`, [participantId], (err, result) => {
              if (err) {
                innerReject(err)
              } else {
                // Resolve true if a record exists, false otherwise
                innerResolve({
                  participantId: participantId,
                  pushUser: result.length > 0
                })
              }
            })
          })
      )
    )
      .then((results) => {
        resolve(results)
      })
      .catch(reject)
  })
}

/**
 *********************************************************
 *********************************************************
 * **INTERNAL FUNCTION FOR TESTING PURPOSES ONLY**
 *********************************************************
 *********************************************************
 */
export async function _deleteUserW2WMeta(did: string): Promise<void> {
  return await new Promise((resolve, reject) => {
    restrictAPICall('/tests/', '/src/')
    db.query('DELETE FROM w2w_meta WHERE did = ?', [did], async (err: any) => {
      if (err) return reject(err)
      return resolve()
    })
  })
}
