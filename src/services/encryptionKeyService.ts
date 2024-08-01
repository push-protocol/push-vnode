import { Inject, Service } from 'typedi'

import {
  publicKeyFetcher,
  verifyEncryptionKeyVerificationProof
} from '../helpers/encryptionKeyHelper'
import { restrictAPICall } from '../helpers/restrictAPICallHelper'
const db = require('../helpers/dbHelper')

@Service()
export default class EncryptionKeyService {
  constructor(@Inject('logger') private logger) {}
  public async registerKeys(
    wallet: string,
    publicKey: string,
    encryptedPrivateKey: string,
    encryptionType: string,
    verificationProof: string,
    chainId: number
  ): Promise<{ success: boolean; err: string | null }> {
    const logger = this.logger
    logger.debug('Trying to register keys for wallet : ' + wallet)

    const { success, verified, error } = await verifyEncryptionKeyVerificationProof(
      wallet,
      verificationProof,
      encryptedPrivateKey,
      publicKey,
      encryptionType,
      chainId
    )
    if (!success || !verified) {
      logger.error(error)
      return { success: false, err: 'Unable to verify verification proof !!!' }
    }

    const query = `INSERT INTO notif_keys (wallet, pgp_pub, pgp_priv_enc, pgp_enc_type, verification_proof) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE pgp_pub="${publicKey}", pgp_priv_enc="${encryptedPrivateKey}", pgp_enc_type="${encryptionType}", verification_proof="${verificationProof}"`

    return await new Promise((resolve, reject) => {
      db.query(
        query,
        [wallet, publicKey, encryptedPrivateKey, encryptionType, verificationProof],
        function (err, results) {
          if (err || results.length === 0) {
            return resolve({ success: false, err: err })
          } else {
            logger.info('Completed registerKeys() for wallet ' + wallet)
            return resolve({
              success: true,
              err: null
            })
          }
        }
      )
    })
  }

  private async _removeKeys(wallet: string): Promise<{ success: boolean; err: string | null }> {
    // IMPORTANT: THIS CALL IS RESTRICTED FOR TEST CASES ONLY //
    restrictAPICall('/tests/', '/src/')
    const logger = this.logger
    logger.debug('Trying to remove keys for wallet : ' + wallet)

    const query = 'DELETE from notif_keys where wallet=?'
    return await new Promise((resolve, reject) => {
      db.query(query, [wallet], function (err, results) {
        if (err || results.length === 0) {
          return resolve({ success: false, err: 'Keys Not Found !!!' })
        } else {
          logger.info('Completed _removeKeys() for wallet ' + wallet)
          return resolve({
            success: true,
            err: null
          })
        }
      })
    })
  }

  public async getKeys(wallet: string): Promise<{ success: boolean; keys: {} | null }> {
    const logger = this.logger
    logger.debug('Trying to get keys for wallet : ' + wallet)

    const query = 'SELECT * FROM notif_keys WHERE wallet=?'

    const response: { success: boolean; keys: {} | null } = await new Promise((resolve, reject) => {
      db.query(query, [wallet], function (err, results) {
        if (err || results.length === 0) {
          logger.info('Completed getKeys() with no results')
          return resolve({ success: false, keys: null })
        } else {
          logger.info('Completed getKeys() for wallet ' + wallet)
          return resolve({
            success: true,
            keys: {
              publicKey: results[0].pgp_pub,
              encryptedPrivateKey: results[0].pgp_priv_enc,
              encryptionType: results[0].pgp_enc_type,
              verificationProof: results[0].verification_proof
            }
          })
        }
      })
    })

    if (!response.success) {
      return await publicKeyFetcher(wallet)
    } else return response
  }
}
