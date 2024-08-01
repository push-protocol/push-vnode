import * as PushSDK from '@pushprotocol/restapi'
import chai from 'chai'

import { startServer, stopServer } from '../../../src/appInit'
const chaiAsPromised = require('chai-as-promised')
import 'mocha'

import { ENV } from '@pushprotocol/restapi/src/lib/constants'
import axios from 'axios'
import chaiHttp from 'chai-http'
import { ethers } from 'ethers'

import {
  _deleteChatByChatId,
  _deleteRequest,
  _deleteUserW2WMeta,
  _updateUserNumberOfMessages,
  getUser
} from '../../../src/db-access/w2w'
import { HttpStatus } from '../../../src/errors/apiConstants'
import { CommonErrors } from '../../../src/errors/commonErrors'
import { combinedWalletDID } from '../../../src/helpers/chatHelper'
import { GroupDTO, Inbox, IntentStatus, Message, User } from '../../../src/interfaces/chat'
import {
  APPROVE_REQUEST,
  CREATE_GROUP,
  CREATE_USER_1,
  CREATE_USER_2,
  INVALID_WALLET_SEND_REQUEST,
  PRIVATE_KEY_USER_2,
  SEND_REQUEST,
  SEND_TEXT_MESSAGE_USER1_USER2,
  SEND_TEXT_MESSAGE_USER2_USER1
} from '../../testdata'
import { PRIVATE_KEY_USER_1 } from '../../testdata'
chai.use(chaiHttp)
chai.use(chaiAsPromised)
chai.should()
const expect = chai.expect

// List of tests to be done
// 1. Don't allow to send intent to group

const V1_BASE_URL_CHAT = 'http://[::1]:4000/apis/v1/chat'
const V1_BASE_URL_USERS = 'http://[::1]:4000/apis/v1/users'
const MISSING_DATA_ERROR_MSG =
  'Error validating request body. "toDID" is required. "messageType" is required. "messageContent" is required. "fromDID" is required. "fromCAIP10" is required. "toCAIP10" is required. "signature" is required. "encType" is required. "encryptedSecret" is required. "sigType" is required.'
const INVALID_DATA_ERROR_MSG =
  '"messageContent" is not allowed to be empty. "fromDID" must be a string. "fromCAIP10" is required. "toCAIP10" is required. "signature" is required. "encType" is required. "encryptedSecret" is required. "sigType" is required.'

const signer1 = new ethers.Wallet(`0x${PRIVATE_KEY_USER_1}`)
const signer2 = new ethers.Wallet(`0x${PRIVATE_KEY_USER_2}`)

// When putting this inside the before function below we get an error, so manually calling it from each test
const createUsers = async () => {
  const promises: Promise<User>[] = []
  promises.push(axios.post(`${V1_BASE_URL_USERS}/`, CREATE_USER_1))
  promises.push(axios.post(`${V1_BASE_URL_USERS}/`, CREATE_USER_2))
  await Promise.all(promises)
}

// When putting this inside the after function below we get an error, so manually calling it from each test
const deleteUsers = async () => {
  const promises: Promise<void>[] = []
  promises.push(_deleteUserW2WMeta(CREATE_USER_1.did))
  promises.push(_deleteUserW2WMeta(CREATE_USER_2.did))
  await Promise.all(promises)
}

const createGroup = async (members: string[]): Promise<GroupDTO> => {
  const { user1DecryptedPGPPrivateKey } = await getPGPPrivateKeys()
  const group: Promise<GroupDTO> = await PushSDK.chat.createGroup({
    env: ENV.LOCAL,
    pgpPrivateKey: user1DecryptedPGPPrivateKey,
    account: signer1.address,
    signer: signer1,
    groupName: 'my group name',
    groupDescription: 'my group description',
    members,
    groupImage:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAvklEQVR4AcXBsW2FMBiF0Y8r3GQb6jeBxRauYRpo4yGQkMd4A7kg7Z/GUfSKe8703fKDkTATZsJsrr0RlZSJ9r4RLayMvLmJjnQS1d6IhJkwE2bT13U/DBzp5BN73xgRZsJMmM1HOolqb/yWiWpvjJSUiRZWopIykTATZsJs5g+1N6KSMiO1N/5DmAkzYTa9Lh6MhJkwE2ZzSZlo7xvRwson3txERzqJhJkwE2bT6+JhoKTMJ2pvjAgzYSbMfgDlXixqjH6gRgAAAABJRU5ErkJggg==',
    admins: [],
    isPublic: true,
    numberOfERC20: 0,
    numberOfNFTs: 0
  })
  return group
}

const getPGPPrivateKeys = async (): Promise<{
  user1DecryptedPGPPrivateKey: string
  user2DecryptedPGPPrivateKey: string
}> => {
  const user1 = await PushSDK.user.get({
    account: `eip155:${signer1.address}`,
    env: ENV.LOCAL
  })
  const user2 = await PushSDK.user.get({
    account: `eip155:${signer2.address}`,
    env: ENV.LOCAL
  })
  const pgpDecryptedPvtKey1 = await PushSDK.chat.decryptPGPKey({
    encryptedPGPPrivateKey: user1.encryptedPrivateKey,
    signer: signer1
  })
  const pgpDecryptedPvtKey2 = await PushSDK.chat.decryptPGPKey({
    encryptedPGPPrivateKey: user2.encryptedPrivateKey,
    signer: signer2
  })
  return {
    user1DecryptedPGPPrivateKey: pgpDecryptedPvtKey1,
    user2DecryptedPGPPrivateKey: pgpDecryptedPvtKey2
  }
}

describe('/chat route', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  describe('POST /request', function () {
    it('Should return 201 when sucess', async function () {
      try {
        // await new Promise((resolve) => setTimeout(resolve, 200))
        // console.log('Created users')
        await createUsers()
        const response = await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        expect(response).to.have.status(201)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when sending duplicated intent', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('Intent already exists')
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return correct response body when sending intent', async function () {
      try {
        await createUsers()
        const response = await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        expect(response).to.have.status(201)
        const message: Message & { cid: string } = response.data
        expect(message).not.to.be.null
        expect(message).not.to.be.undefined
        expect(message.cid).not.to.be.null
        expect(message.cid).not.to.be.undefined
        expect(message.cid).to.be.string
        expect(message.encType).to.be.equal(SEND_REQUEST.encType)
        expect(message.encryptedSecret).to.be.equal(SEND_REQUEST.encryptedSecret)
        expect(message.fromCAIP10).to.be.equal(SEND_REQUEST.fromCAIP10)
        expect(message.fromDID).to.be.equal(SEND_REQUEST.fromDID)
        expect(message.link).to.be.null
        expect(message.messageContent).not.to.be.null
        expect(message.messageContent).not.to.be.undefined
        expect(message.messageType).to.be.equal(SEND_REQUEST.messageType)
        expect(message.sigType).to.be.equal(SEND_REQUEST.sigType)
        expect(message.signature).to.be.equal(SEND_REQUEST.signature)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when required fields are missing', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, {})
      } catch (error) {
        expect(error.response.status).to.equal(400)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when sending invalid data', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, INVALID_WALLET_SEND_REQUEST)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('Wrong wallet format')
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when sending a request to self', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, {
          fromDID: CREATE_USER_1.did,
          fromCAIP10: CREATE_USER_1.caip10,
          toDID: CREATE_USER_1.did,
          toCAIP10: CREATE_USER_1.caip10,
          encType: 'asymmetric',
          messageType: 'request',
          encryptedSecret: 'secret'
        })
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('Both DIDs are the same')
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when sending a request with non-existent users', async function () {
      try {
        await createUsers()
        const nonexistentuser = 'eip155:0x7e796B309772D171e42C3F594B913CD6F2D3474E'
        const requestWithnonexistentuser = {
          ...SEND_REQUEST,
          toDID: nonexistentuser
        }
        await axios.post(`${V1_BASE_URL_CHAT}/request`, requestWithnonexistentuser)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('No user created')
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when verification proof has incorrect format', async function () {
      try {
        await createUsers()
        const invalidVerificationProof = 'invalid-format-verification-proof'
        const requestWithInvalidVerificationProof = {
          ...SEND_REQUEST,
          verificationProof: invalidVerificationProof
        }
        await axios.post(`${V1_BASE_URL_CHAT}/request`, requestWithInvalidVerificationProof)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain(
          'Verification proof must be in the format sigType:signature'
        )
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when message type has incorrect format', async function () {
      try {
        await createUsers()
        const invalidMessageType = 'invalid-message-type'
        const requestWithInvalidMessageType = {
          ...SEND_REQUEST,
          messageType: invalidMessageType
        }
        await axios.post(`${V1_BASE_URL_CHAT}/request`, requestWithInvalidMessageType)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('Invalid signature')
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should have correct verification proof', async function () {
      try {
        await createUsers()
        const response = await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        expect(response).to.have.status(201)
        const message: Message & { cid: string } = response.data
        if (SEND_REQUEST.verificationProof) {
          expect(SEND_REQUEST.verificationProof).to.include('pgp')
        }
        expect(message.sigType).to.be.equal(SEND_REQUEST.sigType)
        expect(message.signature).to.be.equal(SEND_REQUEST.signature)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })
  })

  describe('PUT /request/accept', function () {
    it('Should return success for wallet to wallet if intent is present', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        const response = await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, APPROVE_REQUEST)
        expect(response).to.have.status(201)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return success for approving intent to join a group', async function () {
      let group: GroupDTO
      try {
        await createUsers()
        group = await createGroup([
          `eip155:${signer2.address}`,
          'eip155:0xA2aFbEdF7E5c8bf94ee7a4f7912359104c186881',
          'eip155:0x0A5B8876fc2CA39bD2Ea1e65217356E4bC239a32'
        ])
        const { user1DecryptedPGPPrivateKey, user2DecryptedPGPPrivateKey } =
          await getPGPPrivateKeys()
        const approve = await PushSDK.chat.approve({
          status: 'Approved',
          senderAddress: group.chatId,
          signer: signer2,
          pgpPrivateKey: user2DecryptedPGPPrivateKey,
          env: ENV.LOCAL
        })
        const groupChat = await PushSDK.chat.getGroup({ env: ENV.LOCAL, chatId: group.chatId })
        const pendingMembers = group.pendingMembers
          .map((p) => p.wallet)
          .filter((x) => x !== `eip155:${signer2.address}`)
        const members = [...group.members.map((m) => m.wallet), `eip155:${signer2.address}`]
        expect(groupChat.pendingMembers.map((p) => p.wallet).sort()).deep.equal(
          pendingMembers.sort()
        )
        expect(groupChat.members.map((m) => m.wallet).sort()).deep.equal(members.sort())
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await _deleteChatByChatId({ chatId: group!.chatId })
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return success for auto-joining a group', async function () {
      let group: GroupDTO
      try {
        await createUsers()
        group = await createGroup([
          'eip155:0xA2aFbEdF7E5c8bf94ee7a4f7912359104c186881',
          'eip155:0x0A5B8876fc2CA39bD2Ea1e65217356E4bC239a32'
        ])
        // User2 should not be a member of the group
        expect(group.members.map((m) => m.wallet)).not.to.include(`eip155:${signer2.address}`)
        expect(group.pendingMembers.map((m) => m.wallet)).not.to.include(
          `eip155:${signer2.address}`
        )
        const { user1DecryptedPGPPrivateKey, user2DecryptedPGPPrivateKey } =
          await getPGPPrivateKeys()
        const approve = await PushSDK.chat.approve({
          status: 'Approved',
          senderAddress: group.chatId,
          signer: signer2,
          pgpPrivateKey: user2DecryptedPGPPrivateKey,
          env: ENV.LOCAL
        })
        const groupChat = await PushSDK.chat.getGroup({ env: ENV.LOCAL, chatId: group.chatId })
        const pendingMembers = group.pendingMembers.map((p) => p.wallet)
        const members = [...group.members.map((m) => m.wallet), `eip155:${signer2.address}`]
        expect(groupChat.pendingMembers.map((p) => p.wallet).sort()).deep.equal(
          pendingMembers.sort()
        )
        expect(groupChat.members.map((m) => m.wallet).sort()).deep.equal(members.sort())
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await _deleteChatByChatId({ chatId: group!.chatId })
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when required fields are missing', async function () {
      try {
        await createUsers()
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, {})
      } catch (error) {
        expect(error.response.status).to.equal(400)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when sending invalid data', async function () {
      try {
        await createUsers()
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, {
          combinedDID: 123,
          encryptedSecret: 'invalid-encrypted-secret',
          link: 'invalid-link',
          messageType: 'invalid-message-type'
        })
      } catch (error) {
        expect(error.response.status).to.equal(400)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when the intent does not exist', async function () {
      try {
        await createUsers()
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, APPROVE_REQUEST)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('There is no intent to approve')
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when sending an invalid verification proof', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        const invalidVerificationProof = 'invalid-format-verification-proof'
        const requestWithInvalidVerificationProof = {
          ...APPROVE_REQUEST,
          verificationProof: invalidVerificationProof
        }
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, requestWithInvalidVerificationProof)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('signature and sigType are required')
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when toDID and fromDID are the same', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        const requestWithEqualFromAndToDID = {
          ...APPROVE_REQUEST,
          fromDID: APPROVE_REQUEST.toDID
        }
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, requestWithEqualFromAndToDID)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('DID are the same')
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when reproving an intent', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        const requestWithReprovedStatus = {
          ...APPROVE_REQUEST,
          status: IntentStatus.Reproved
        }
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, requestWithReprovedStatus)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('Status is not valid')
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when invalid toDID', async function () {
      const toDID = 'invalid-to-did'
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        const requestWithReprovedStatus = {
          ...APPROVE_REQUEST,
          toDID
        }
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, requestWithReprovedStatus)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain(`Invalid chatId ${toDID}`)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })
  })

  describe('POST /message', function () {
    it('Should send message with success if intent is present', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, APPROVE_REQUEST)
        const response = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER1_USER2
        )
        expect(response).to.have.status(201)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should allow to send multiple messages between users', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, APPROVE_REQUEST)
        const response1 = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER1_USER2
        )
        const response2 = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER1_USER2
        )
        const response3 = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER1_USER2
        )
        expect(response1).to.have.status(201)
        expect(response2).to.have.status(201)
        expect(response3).to.have.status(201)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should correctly set number of messages sent', async function () {
      try {
        await createUsers()
        await _updateUserNumberOfMessages({ did: CREATE_USER_1.did, numberOfMessages: 2 })
        await _updateUserNumberOfMessages({ did: CREATE_USER_2.did, numberOfMessages: 2 })
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, APPROVE_REQUEST)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
        const user1 = await getUser(CREATE_USER_1.did)
        const user2 = await getUser(CREATE_USER_2.did)
        expect(user1.numMsg).to.be.equal(2)
        expect(user2.numMsg).to.be.equal(0)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should correctly set linked_list_hash column', async function () {
      try {
        await createUsers()
        const { data: request } = await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, APPROVE_REQUEST)
        // User1 to User2
        const { data: firstMessageU1U2 } = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER1_USER2
        )
        const { data: secondMessageU1U2 } = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER1_USER2
        )
        const { data: thirdMessageU1U2 } = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER1_USER2
        )
        // User2 to User1
        const { data: firstMessageU2U1 } = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER2_USER1
        )
        const { data: secondMessageU2U1 } = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER2_USER1
        )
        const { data: user1 } = await axios.get(`${V1_BASE_URL_USERS}?did=${CREATE_USER_1.did}`)
        const { data: user2 } = await axios.get(`${V1_BASE_URL_USERS}?did=${CREATE_USER_2.did}`)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when required fields are missing', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/message`, {})
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain(MISSING_DATA_ERROR_MSG)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 when sending invalid data', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/message`, {
          fromDID: 123,
          toDID: 'invalid-toDID',
          messageType: 'invalid-message-type',
          messageContent: ''
        })
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain(INVALID_DATA_ERROR_MSG)
      }
    })

    it('Should return 400 when the chat is not approved yet', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('Chat is not approved yet')
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 if from and to DID are same', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, APPROVE_REQUEST)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, {
          ...SEND_TEXT_MESSAGE_USER1_USER2,
          fromDID: CREATE_USER_1.did,
          toDID: CREATE_USER_1.did
        })
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain(`You can\'t send message to yourself`)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 400 if from CAIP and from DID are different', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, APPROVE_REQUEST)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, {
          ...SEND_TEXT_MESSAGE_USER1_USER2,
          fromDID: CREATE_USER_1.did,
          fromCAIP10: CREATE_USER_2.caip10
        })
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain(`Invalid from or to address`)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })
  })

  describe('GET /users/:did/messages', function () {
    it('Should be empty when no messages', async function () {
      try {
        await createUsers()
        const responseUser1 = await axios.get(
          `${V1_BASE_URL_CHAT}/users/${CREATE_USER_1.did}/messages`
        )
        const responseUser2 = await axios.get(
          `${V1_BASE_URL_CHAT}/users/${CREATE_USER_2.did}/messages`
        )
        expect(responseUser1).to.have.status(200)
        expect(responseUser1.data).to.be.an('array').that.is.empty
        expect(responseUser2).to.have.status(200)
        expect(responseUser2.data).to.be.an('array').that.is.empty
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return correctly the latest message sent on if there is a chatnbox when multiple messages are sent', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, APPROVE_REQUEST)
        // Send multiple messages
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
        const responseUser1 = await axios.get(
          `${V1_BASE_URL_CHAT}/users/${CREATE_USER_1.did}/chats`
        )
        const responseUser2 = await axios.get(
          `${V1_BASE_URL_CHAT}/users/${CREATE_USER_2.did}/chats`
        )
        const inboxUser1: Inbox[] = responseUser1.data.chats
        const inboxUser2: Inbox[] = responseUser2.data.chats
        expect(inboxUser1.length).to.be.equal(1)
        expect(inboxUser2.length).to.be.equal(1)

        // Validate chatId
        expect(inboxUser1[0].chatId).to.be.not.null
        expect(inboxUser1[0].chatId).to.be.not.undefined
        expect(inboxUser2[0].chatId).to.be.not.null
        expect(inboxUser2[0].chatId).to.be.not.undefined
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })
  })

  describe('GET /request', function () {
    it('Should correctly get all requests', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        const responseUser1 = await axios.get(
          `${V1_BASE_URL_CHAT}/users/${CREATE_USER_1.did}/requests`
        )
        const responseUser2 = await axios.get(
          `${V1_BASE_URL_CHAT}/users/${CREATE_USER_2.did}/requests`
        )
        expect(responseUser1).to.have.status(200)
        expect(responseUser2).to.have.status(200)
        // Requets should be only for CREATE_USER_2
        const requestsUser1: { requests: Inbox[] } = responseUser1.data
        const requestsUser2: { requests: Inbox[] } = responseUser2.data
        expect(requestsUser1.requests).to.be.an('array').that.is.empty
        expect(requestsUser2.requests.length).to.be.equal(1)

        // Validate chatId
        expect(requestsUser2.requests[0].chatId).to.be.not.null
        expect(requestsUser2.requests[0].chatId).to.be.not.undefined
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 200 and an empty array if there are no pending requests', async function () {
      try {
        await createUsers()
        const response = await axios.get(`${V1_BASE_URL_CHAT}/users/${CREATE_USER_1.did}/requests`)
        expect(response).to.have.status(200)
        expect(response.data.requests).to.be.an('array').that.is.empty
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
      }
    })
  })

  describe('GET /users/:fromuser/conversations/:conversationid/hash', function () {
    it('Should correctly return latest threadhash when multiple messages sent', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        await axios.put(`${V1_BASE_URL_CHAT}/request/accept`, APPROVE_REQUEST)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
        await axios.post(`${V1_BASE_URL_CHAT}/message`, SEND_TEXT_MESSAGE_USER1_USER2)
        const { data: lastMessage }: { data: Message & { cid: string } } = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER1_USER2
        )
        const { data: latestThreadHash }: { data: { threadHash: string } } = await axios.get(
          `${V1_BASE_URL_CHAT}/users/${SEND_TEXT_MESSAGE_USER1_USER2.fromDID}/conversations/${SEND_TEXT_MESSAGE_USER1_USER2.toDID}/hash`
        )
        expect(lastMessage.cid).to.be.equal(latestThreadHash.threadHash)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })
  })

  describe('GET /users/:did/chats/:recipient', function () {
    it('Should return 200 with correct response body if there is a DM chat', async function () {
      try {
        await createUsers()
        await axios.post(`${V1_BASE_URL_CHAT}/request`, SEND_REQUEST)
        const { data: dataSecondMessage } = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER1_USER2
        )
        const { data: dataLastMessage } = await axios.post(
          `${V1_BASE_URL_CHAT}/message`,
          SEND_TEXT_MESSAGE_USER1_USER2
        )
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const response = await axios.get(
          `${V1_BASE_URL_CHAT}/users/${CREATE_USER_1.did}/chat/${CREATE_USER_2.did}`
        )
        expect(response).to.have.status(200)
        const lastMessage: Message & { cid: string } = dataLastMessage
        const inbox: Inbox = response.data
        expect(lastMessage.cid).to.be.equal(inbox.threadhash)
        expect(lastMessage.toCAIP10).to.be.equal(inbox.did)
        expect(lastMessage.toDID).to.be.equal(inbox.did)
        expect(lastMessage.link).to.include(inbox.threadhash)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        const { combinedDID } = combinedWalletDID({
          firstDID: CREATE_USER_1.did,
          secondDID: CREATE_USER_2.did
        })
        await _deleteRequest({ combinedDID })
      }
    })

    it('Should return 200 if there is a Group Chat', async function () {
      let group: GroupDTO
      try {
        await createUsers()
        group = await createGroup([
          `eip155:${signer2.address}`,
          'eip155:0xA2aFbEdF7E5c8bf94ee7a4f7912359104c186881',
          'eip155:0x0A5B8876fc2CA39bD2Ea1e65217356E4bC239a32'
        ])
        const inboxResponse = await axios.get(
          `${V1_BASE_URL_CHAT}/users/${CREATE_USER_1.did}/chat/${group.chatId}`
        )
        const inbox: Inbox = inboxResponse.data
        const combinedDID: string = [
          ...group.pendingMembers.map((m) => m.wallet),
          group.groupCreator
        ]
          .sort()
          .join('_')
        expect(inboxResponse).to.have.status(200)
        expect(inbox.combinedDID.split('').sort().join('')).to.be.equal(
          combinedDID.split('').sort().join('')
        )
        expect(inbox.did).to.be.null
        expect(inbox.wallets).to.be.null
        expect(inbox.profilePicture).to.be.null
        expect(inbox.about).to.be.null
        expect(inbox.threadhash).to.be.null
        expect(inbox.publicKey).to.be.null
        expect(inbox.intent).to.be.equal(group.groupCreator)
        expect(inbox.intentSentBy).to.be.equal(group.groupCreator)
        expect(inbox?.groupInformation?.chatId).to.be.equal(group.chatId)
        expect(inbox?.groupInformation?.groupCreator).to.be.equal(group.groupCreator)
        expect(inbox?.groupInformation?.isPublic).to.be.equal(group.isPublic)
        expect(inbox?.groupInformation?.groupDescription).to.be.equal(group.groupDescription)
        expect(inbox?.groupInformation?.groupName).to.be.equal(group.groupName)
        expect(inbox?.groupInformation?.contractAddressERC20).to.be.equal(
          group.contractAddressERC20
        )
        expect(inbox?.groupInformation?.contractAddressNFT).to.be.equal(group.contractAddressNFT)
        expect(inbox?.groupInformation?.verificationProof).to.be.equal(group.verificationProof)
        expect(inbox?.groupInformation?.verificationProof).to.be.equal(group.verificationProof)
        expect(inbox?.groupInformation?.pendingMembers.sort()).deep.equal(
          group.pendingMembers.sort()
        ) // Used to compare arrays
        expect(inbox?.groupInformation?.numberOfERC20).to.be.equal(group.numberOfERC20)
        expect(inbox?.groupInformation?.numberOfNFTTokens).to.be.equal(group.numberOfNFTTokens)
        expect(inbox?.groupInformation?.members.sort()).deep.equal(group.members.sort())
        expect(inbox?.groupInformation?.groupImage).to.be.equal(group.groupImage)
        expect(inbox?.groupInformation?.groupType).to.be.equal(group.groupType)
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
        await _deleteChatByChatId({ chatId: group!.chatId })
      }
    })

    it("Should return 200 with {} as response body when chat doesn't exist", async function () {
      try {
        await createUsers()
        const { data } = await axios.get(
          `${V1_BASE_URL_CHAT}/users/${CREATE_USER_1.did}/chat/${CREATE_USER_2.did}`
        )
        // Returns {}
        expect(data).to.be.empty
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
      }
    })
  })

  describe('POST /groups', function () {
    it('Should return 200 when correct payload with correct response body', async function () {
      let group: GroupDTO
      try {
        await createUsers()
        group = await createGroup([
          `eip155:${signer2.address}`,
          'eip155:0xA2aFbEdF7E5c8bf94ee7a4f7912359104c186881',
          'eip155:0x0A5B8876fc2CA39bD2Ea1e65217356E4bC239a32'
        ])
        expect(group.scheduleAt).to.be.null
        expect(group.scheduleEnd).to.be.null
        expect(group.members).to.be.an('array')
        expect(group.pendingMembers).to.be.an('array')
        expect(group.pendingMembers.map((p) => p.wallet).sort()).deep.equal(
          [
            `eip155:${signer2.address}`,
            'eip155:0xA2aFbEdF7E5c8bf94ee7a4f7912359104c186881',
            'eip155:0x0A5B8876fc2CA39bD2Ea1e65217356E4bC239a32'
          ].sort()
        )
        expect(group.groupCreator).to.be.equal(`eip155:${signer1.address}`)
        expect(group.isPublic).to.be.true
        expect(group.members.map((m) => m.wallet)).deep.equal([`eip155:${signer1.address}`])
        expect(group.numberOfERC20).to.be.equal(0)
        expect(group.numberOfNFTTokens).to.be.equal(0)
        expect(group.contractAddressERC20).to.be.null
        expect(group.contractAddressNFT).to.be.null
        expect(group.groupName).to.be.equal('my group name')
        expect(group.groupDescription).to.be.equal('my group description')
        expect(group.groupImage?.trim()).to.be.equal(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAvklEQVR4AcXBsW2FMBiF0Y8r3GQb6jeBxRauYRpo4yGQkMd4A7kg7Z/GUfSKe8703fKDkTATZsJsrr0RlZSJ9r4RLayMvLmJjnQS1d6IhJkwE2bT13U/DBzp5BN73xgRZsJMmM1HOolqb/yWiWpvjJSUiRZWopIykTATZsJs5g+1N6KSMiO1N/5DmAkzYTa9Lh6MhJkwE2ZzSZlo7xvRwson3txERzqJhJkwE2bT6+JhoKTMJ2pvjAgzYSbMfgDlXixqjH6gRgAAAABJRU5ErkJggg=='
        )
        expect(group.groupType).to.be.equal('default')
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 600))
        await deleteUsers()
        await _deleteChatByChatId({ chatId: group!.chatId })
      }
    })

    it('Should return 400 when invalid groupType', async function () {
      try {
        await createUsers()
        const invalidGroupType = 'invalidGroupType'
        const groupInvalidGroupType = { ...CREATE_GROUP, groupType: invalidGroupType }
        await axios.post(`${V1_BASE_URL_CHAT}/groups`, groupInvalidGroupType)
      } catch (error) {
        expect(error.response.status).to.equal(400)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
      }
    })

    it('Should allow to create group with valid groupTypes default, spaces and live', async function () {
      let group: GroupDTO
      try {
        await createUsers()
        const validGroupTypes = ['default', 'spaces']
        for (const groupType of validGroupTypes) {
          const groupResponse = await axios.post(`${V1_BASE_URL_CHAT}/groups`, {
            ...CREATE_GROUP,
            groupType
          })
          group = groupResponse.data
          expect(groupResponse).to.have.status(200)
          await new Promise((resolve) => setTimeout(resolve, 200))
          await _deleteChatByChatId({ chatId: group!.chatId })
        }
      } catch (error) {
        throw new Error(error)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
      }
    })

    it('Should return 400 when Schedule end time is earlier than start time.', async function () {
      try {
        await createUsers()
        const payload = {
          ...CREATE_GROUP,
          scheduleEnd: new Date('2025-03-10T10:00:00.000Z')
        }
        await axios.post(`${V1_BASE_URL_CHAT}/groups`, payload)
      } catch (error) {
        expect(error.response.status).to.equal(HttpStatus.BadRequest)
        expect(error.response.data.errorCode).to.equal(CommonErrors.InvalidScheduleTimeRange)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
      }
    })

    it('Should return 400 when Schedule end time or start time is in past.', async function () {
      try {
        await createUsers()
        const payload = {
          ...CREATE_GROUP,
          scheduleAt: '2021-04-10T10:00:00.000Z',
          scheduleEnd: '2021-05-10T10:00:00.000Z'
        }
        await axios.post(`${V1_BASE_URL_CHAT}/groups`, payload)
      } catch (error) {
        expect(error.response.status).to.equal(HttpStatus.BadRequest)
        expect(error.response.data.errorCode).to.equal(CommonErrors.InvalidScheduleStartTime)
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await deleteUsers()
      }
    })
  })
})
