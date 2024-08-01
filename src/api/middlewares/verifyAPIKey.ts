const bcrypt = require('bcrypt')
import { Container } from 'typedi'

import APIKeysService from '../../services/apikeysService'

const verifyAPIKey = async (req, res, next) => {
  const token = req.headers['authorization']
  if (token) {
    const list = req.headers['authorization'].split(' ')
    if (list.length == 2) {
      try {
        const apiKeysService = Container.get(APIKeysService)
        const response = await apiKeysService.getAPIKey(list[1])
        if (response) {
          const A = list[1].split('.')
          const apiKey = A[1]
          const valid =
            (await bcrypt.compare(apiKey, response['key_hash'])) &&
            new Date().getTime() <= new Date(response['validity_up_to']).getTime()
          if (valid) {
            return next()
          } else {
            /*res.status(401).json({
                            error: "Invalid token"
                        });*/
          }
        } else {
          //return res.status(401).send("Invalid Token");
        }
      } catch (err) {
        //return res.status(401).send("Invalid Token");
      }
    }
  }
  return next()
}

export default verifyAPIKey
