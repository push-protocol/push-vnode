import { Container } from 'typedi'

const db = require('../../helpers/dbHelper')
const crypto = require('../../helpers/cryptoHelper')

/**
 * @param {*} req Express req Object
 * @param {*} res  Express res Object
 * @param {*} next  Express next Function
 * @param {*} op_to_match  Operation to Match
 */
const onlyAuthorized = async (req, res, next, opToValidate) => {
  const Logger = Container.get('logger')

  const query = 'SELECT for_wallet, secret FROM servertokens WHERE server_token=? LIMIT 1'

  const server_token_res = async (query, server_token, logger) => {
    return new Promise((resolve, reject) => {
      db.query(query, [server_token], function (err, results) {
        if (err) {
          Logger.error(err)
          return reject(err)
        } else {
          Logger.info('Wallet retrieved for checking: %o', results)
          return resolve({ success: 1, data: results[0] })
        }
      })
    })
  }

  try {
    const response = await server_token_res(query, req.body.server_token, Logger)

    if (response && response.success) {
      // Check if token exists
      const data = response.data
      Logger.debug('Checking Response')

      if (data) {
        const secret = data.secret
        Logger.debug('Secret retrieved: ' + secret + ' Decrypting op_enc ...')

        const retrievedOP = crypto.decryptWithAES(req.body.op_aes, secret)
        Logger.debug('Decrypted Operation: [' + retrievedOP + ']')

        if (retrievedOP === opToValidate) {
          req.body.device_token_decrypted = crypto.decryptWithAES(req.body.device_token_aes, secret)
          req.body.platform_decrypted = crypto.decryptWithAES(req.body.platform_aes, secret)
          req.body.wallet = data.for_wallet
        }
      } else {
        return res.status(401).json({ info: 'Token expired or never existed' })
      }

      return next()
    } else {
      return res.sendStatus(500).json({ info: 'Server behaved unexpectedly' })
    }

    return next()
  } catch (e) {
    throw e
    return next(e)
  }
}

export default onlyAuthorized
