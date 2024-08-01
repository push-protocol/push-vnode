import * as CryptoJS from 'crypto-js'
import { Router } from 'express'

import config from '../../../config'

const route = Router()
export default (app: Router) => {
  //load internal routes

  app.use(`/${config.api.version}/turnserver`, route)

  route.get('/iceconfig', (req, res) => {
    const servers = {
      config: [
        {
          url: `stun:${process.env.TURN_SERVER_URL}:3478`,
          urls: `stun:${process.env.TURN_SERVER_URL}:3478`
        },
        {
          url: `turn:${process.env.TURN_SERVER_URL}:3478?transport=udp`,
          username: `${process.env.TURN_SERVER_USERNAME}`,
          urls: `turn:${process.env.TURN_SERVER_URL}:3478?transport=udp`,
          credential: `${process.env.TURN_SERVER_PASSWORD}`
        },
        {
          url: `turn:${process.env.TURN_SERVER_URL}:3478?transport=tcp`,
          username: `${process.env.TURN_SERVER_USERNAME}`,
          urls: `turn:${process.env.TURN_SERVER_URL}:3478?transport=tcp`,
          credential: `${process.env.TURN_SERVER_PASSWORD}`
        },
        {
          url: `turn:${process.env.TURN_SERVER_URL}:443?transport=tcp`,
          username: `${process.env.TURN_SERVER_USERNAME}`,
          urls: `turn:${process.env.TURN_SERVER_URL}:443?transport=tcp`,
          credential: `${process.env.TURN_SERVER_PASSWORD}`
        }
      ]
    }

    const encryptedresponse = CryptoJS.AES.encrypt(
      JSON.stringify(servers),
      process.env.TURN_SERVER_SECRET
    ).toString()

    res.send(encryptedresponse).status(200)
  })
}
