import chai from 'chai'
const chaiAsPromised = require('chai-as-promised')
import 'mocha'

import axios from 'axios'
import chaiHttp from 'chai-http'

import { startServer, stopServer } from '../../../src/appInit'
import { _deleteUserW2WMeta } from '../../../src/db-access/w2w'
import { HttpStatus } from '../../../src/errors/apiConstants'
import { CommonErrors } from '../../../src/errors/commonErrors'
import { User, UserV2 } from '../../../src/interfaces/chat'
import { CREATE_USER_1, CREATE_USER_2 } from '../../testdata'
chai.use(chaiHttp)
chai.use(chaiAsPromised)
chai.should()
const expect = chai.expect

const V1_BASE_URL = 'http://[::1]:4000/apis/v1/users'
const V2_BASE_URL = 'http://[::1]:4000/apis/v2/users'

describe('/users route', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  describe('Creating user', function () {
    it('Should return 201 when creating user', async function () {
      try {
        const response = await axios.post(`${V1_BASE_URL}/`, CREATE_USER_1)
        expect(response).to.have.status(201)
      } catch (err) {
        throw new Error(err)
      } finally {
        await _deleteUserW2WMeta(CREATE_USER_1.did)
      }
    })

    it('Should return correct response body when creating user', async function () {
      try {
        const response = await axios.post(`${V1_BASE_URL}/`, CREATE_USER_1)
        expect(response).to.have.status(201)
        const user: User = response.data
        expect(user).not.to.be.null
        expect(user).not.to.be.undefined
        expect(user.did).to.be.equal(CREATE_USER_1.did)
        expect(user.wallets).to.be.equal(CREATE_USER_1.caip10)
        expect(user.publicKey).to.be.equal(CREATE_USER_1.publicKey)
        expect(user.publicKey).to.contains('-----BEGIN PGP PUBLIC KEY BLOCK-----\n\n')
        expect(user.encryptedPrivateKey).to.be.equal(CREATE_USER_1.encryptedPrivateKey)
        expect(user.encryptedPrivateKey).to.contains(
          '{"version":"x25519-xsalsa20-poly1305","nonce"'
        )
        expect(user.encryptedPassword).to.be.null
        expect(user.nftOwner).to.be.null
        expect(user.signature).to.be.equal(CREATE_USER_1.signature)
        expect(user.sigType).to.be.equal(CREATE_USER_1.sigType)
        expect(user.profilePicture).to.contains('data:image/png;base64,')
        expect(user.about).to.be.null
        expect(user.name).to.be.null
        expect(user.numMsg).to.be.equal(0)
        expect(user.allowedNumMsg).to.be.equal(1000)
        expect(user.linkedListHash).to.be.equal('')
      } catch (err) {
        throw new Error(err)
      } finally {
        await _deleteUserW2WMeta(CREATE_USER_1.did)
      }
    })

    it('Should return correct response body when fetching user', async function () {
      try {
        const createUserResponse = await axios.post(`${V1_BASE_URL}/`, CREATE_USER_1)
        expect(createUserResponse).to.have.status(201)

        const response = await axios.get(`${V1_BASE_URL}/?did=` + createUserResponse.data.did)
        const user: User = response.data

        expect(user).not.to.be.null
        expect(user).not.to.be.undefined
        expect(user.did).to.be.equal(CREATE_USER_1.did)
        expect(user.wallets).to.be.equal(CREATE_USER_1.caip10)
        expect(user.publicKey).to.be.equal(CREATE_USER_1.publicKey)
        expect(user.publicKey).to.contains('-----BEGIN PGP PUBLIC KEY BLOCK-----\n\n')
        expect(user.encryptedPrivateKey).to.be.equal(CREATE_USER_1.encryptedPrivateKey)
        expect(user.encryptedPrivateKey).to.contains(
          '{"version":"x25519-xsalsa20-poly1305","nonce"'
        )
        expect(user.encryptedPassword).to.be.null
        expect(user.nftOwner).to.be.null
        expect(user.signature).to.be.equal(CREATE_USER_1.signature)
        expect(user.sigType).to.be.equal(CREATE_USER_1.sigType)
        expect(user.profilePicture).to.contains('data:image/png;base64,')
        expect(user.about).to.be.null
        expect(user.name).to.be.null
        expect(user.numMsg).to.be.equal(0)
        expect(user.allowedNumMsg).to.be.equal(1000)
        expect(user.linkedListHash).to.be.equal(null)
      } catch (err) {
        throw new Error(err)
      } finally {
        await _deleteUserW2WMeta(CREATE_USER_1.did)
      }
    })

    it('Should return correct response body when creating V2 user', async function () {
      try {
        const response = await axios.post(`${V2_BASE_URL}/`, CREATE_USER_1)
        expect(response).to.have.status(201)

        const user: UserV2 = response.data

        expect(user).not.to.be.null
        expect(user).not.to.be.undefined
        expect(user.did).to.be.equal(CREATE_USER_1.did)
        expect(user.wallets).to.be.equal(CREATE_USER_1.caip10)
        expect(user.publicKey).to.be.equal(CREATE_USER_1.publicKey)
        expect(user.publicKey).to.contains('-----BEGIN PGP PUBLIC KEY BLOCK-----\n\n')
        expect(user.encryptedPrivateKey).to.be.equal(CREATE_USER_1.encryptedPrivateKey)
        expect(user.encryptedPrivateKey).to.contains(
          '{"version":"x25519-xsalsa20-poly1305","nonce"'
        )
        expect(user.profile.picture).to.contains('data:image/png;base64,')
        expect(user.profile.desc).to.be.null
        expect(user.profile.name).to.be.null
        expect(user.profile.profileVerificationProof).to.be.null

        expect(user.msgSent).to.be.equal(0)
        expect(user.maxMsgPersisted).to.be.equal(1000)
      } catch (err) {
        throw new Error(err)
      } finally {
        await _deleteUserW2WMeta(CREATE_USER_1.did)
      }
    })

    it('Should return correct response body when fetching V2 user', async function () {
      try {
        const createUserResponse = await axios.post(`${V2_BASE_URL}/`, CREATE_USER_1)
        expect(createUserResponse).to.have.status(201)

        const response = await axios.get(`${V2_BASE_URL}/?did=` + createUserResponse.data.did)
        const user: UserV2 = response.data

        expect(user).not.to.be.null
        expect(user).not.to.be.undefined
        expect(user.did).to.be.equal(CREATE_USER_1.did)
        expect(user.wallets).to.be.equal(CREATE_USER_1.caip10)
        expect(user.publicKey).to.be.equal(CREATE_USER_1.publicKey)
        expect(user.publicKey).to.contains('-----BEGIN PGP PUBLIC KEY BLOCK-----\n\n')
        expect(user.encryptedPrivateKey).to.be.equal(CREATE_USER_1.encryptedPrivateKey)
        expect(user.encryptedPrivateKey).to.contains(
          '{"version":"x25519-xsalsa20-poly1305","nonce"'
        )
        expect(user.profile.picture).to.contains('data:image/png;base64,')
        expect(user.profile.desc).to.be.null
        expect(user.profile.name).to.be.null
        expect(user.profile.profileVerificationProof).to.be.null

        expect(user.msgSent).to.be.equal(0)
        expect(user.maxMsgPersisted).to.be.equal(1000)
      } catch (err) {
        throw new Error(err)
      } finally {
        await _deleteUserW2WMeta(CREATE_USER_1.did)
      }
    })

    it('Should return correct response body when fetching V2 batch users', async function () {
      try {
        const createUserResponse1 = await axios.post(`${V2_BASE_URL}/`, CREATE_USER_1)
        expect(createUserResponse1).to.have.status(201)

        const createUserResponse2 = await axios.post(`${V2_BASE_URL}/`, CREATE_USER_2)
        expect(createUserResponse2).to.have.status(201)

        const response = await axios.post(`${V2_BASE_URL}/batch`, {
          userIds: [createUserResponse1.data.did, createUserResponse2.data.did]
        })
        expect(response).to.have.status(200)

        const users: UserV2[] = response.data.users

        for (const user of users) {
          const expectedUser = user.did === CREATE_USER_1.did ? CREATE_USER_1 : CREATE_USER_2

          expect(user).not.to.be.null
          expect(user).not.to.be.undefined
          expect(user.did).to.be.equal(expectedUser.did)
          expect(user.wallets).to.be.equal(expectedUser.caip10)
          expect(user.publicKey).to.be.equal(expectedUser.publicKey)
          expect(user.publicKey).to.contains('-----BEGIN PGP PUBLIC KEY BLOCK-----\n\n')
          expect(user.encryptedPrivateKey).to.be.equal(expectedUser.encryptedPrivateKey)
          expect(user.encryptedPrivateKey).to.contains(
            '{"version":"x25519-xsalsa20-poly1305","nonce"'
          )
          expect(user.profile.picture).to.contains('data:image/png;base64,')
          expect(user.profile.desc).to.be.null
          expect(user.profile.name).to.be.null
          expect(user.profile.profileVerificationProof).to.be.null

          expect(user.msgSent).to.be.equal(0)
          expect(user.maxMsgPersisted).to.be.equal(1000)
        }
      } catch (err) {
        throw new Error(err)
      } finally {
        await _deleteUserW2WMeta(CREATE_USER_1.did)

        await _deleteUserW2WMeta(CREATE_USER_2.did)
      }
    })

    it('Should return correct response body when fetching V1 batch users', async function () {
      try {
        const createUserResponse1 = await axios.post(`${V1_BASE_URL}/`, CREATE_USER_1)
        expect(createUserResponse1).to.have.status(201)

        const createUserResponse2 = await axios.post(`${V1_BASE_URL}/`, CREATE_USER_2)
        expect(createUserResponse2).to.have.status(201)

        const response = await axios.post(`${V1_BASE_URL}/batch`, {
          userIds: [createUserResponse1.data.did, createUserResponse2.data.did]
        })
        expect(response).to.have.status(200)

        const users: User[] = response.data.users

        for (const user of users) {
          const expectedUser = user.did === CREATE_USER_1.did ? CREATE_USER_1 : CREATE_USER_2

          expect(user).not.to.be.null
          expect(user).not.to.be.undefined
          expect(user.did).to.be.equal(expectedUser.did)
          expect(user.wallets).to.be.equal(expectedUser.caip10)
          expect(user.publicKey).to.be.equal(expectedUser.publicKey)
          expect(user.publicKey).to.contains('-----BEGIN PGP PUBLIC KEY BLOCK-----\n\n')
          expect(user.encryptedPrivateKey).to.be.equal(expectedUser.encryptedPrivateKey)
          expect(user.encryptedPrivateKey).to.contains(
            '{"version":"x25519-xsalsa20-poly1305","nonce"'
          )
          expect(user.encryptedPassword).to.be.null
          expect(user.nftOwner).to.be.null
          expect(user.signature).to.be.equal(expectedUser.signature)
          expect(user.sigType).to.be.equal(expectedUser.sigType)
          expect(user.profilePicture).to.contains('data:image/png;base64,')
          expect(user.about).to.be.null
          expect(user.name).to.be.null
          expect(user.numMsg).to.be.equal(0)
          expect(user.allowedNumMsg).to.be.equal(1000)
          expect(user.linkedListHash).to.be.equal(null)
        }
      } catch (err) {
        throw new Error(err)
      } finally {
        await _deleteUserW2WMeta(CREATE_USER_1.did)

        await _deleteUserW2WMeta(CREATE_USER_2.did)
      }
    })

    it('Should have 1000 new message in freemium plan', async function () {
      try {
        const response = await axios.post(`${V1_BASE_URL}/`, CREATE_USER_1)
        expect(response).to.have.status(201)
        const user: User = response.data
        expect(user.allowedNumMsg).to.be.equal(1000)
      } catch (err) {
        throw new Error(err)
      } finally {
        await _deleteUserW2WMeta(CREATE_USER_1.did)
      }
    })

    it('Should return 400 when creating duplicated user', async function () {
      try {
        await axios.post(`${V1_BASE_URL}/`, CREATE_USER_1)
        await axios.post(`${V1_BASE_URL}/`, CREATE_USER_1)
      } catch (error) {
        expect(error.response.status).to.equal(400)
        expect(error.response.data).to.contain('Wallet has already been linked to a DID')
      } finally {
        await _deleteUserW2WMeta(CREATE_USER_1.did)
      }
    })

    it('Should return 400 when empty requets body', async function () {
      try {
        await axios.post(`${V1_BASE_URL}/`, {})
      } catch (error) {
        expect(error.response.status).to.equal(400)
      }
    })

    it('Should return 400 if invalid address', async function () {
      try {
        const errorUser = { ...CREATE_USER_1 }
        errorUser.did = '0xabc'
        await axios.post(`${V1_BASE_URL}/`, errorUser)
      } catch (error) {
        expect(error.response.status).to.equal(HttpStatus.BadRequest)
        expect(error.response.data.errorCode).to.equal(CommonErrors.InvalidAPIInput)
      }
    })
  })
})
