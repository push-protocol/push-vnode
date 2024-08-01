import { Inject } from 'typedi'

import config from '../../config'
import { convertCaipToObject } from '../../helpers/caipHelper'
import * as db from '../../helpers/dbHelper'
import { restrictAPICall } from '../../helpers/restrictAPICallHelper'
import { verifyEip712ProofV2 } from '../../helpers/signatureVerificationHelpers'

type channelMetaType = {
  name: string
  info: string
  icon: string
  url: string
  aliasDetails?: { [key: string]: string }
}

type channelPrecacheInput = {
  channel: string
  channelMeta: channelMetaType
  channelMetaVerificationProof: string
}

type channelPrecacheOutput = {
  channel: string
  channelMeta: channelMetaType
}

// HELPERS FOR VALIDATION DATA
export function validateChannelMetaSiganture(data: {
  channel: string
  channelMeta: channelMetaType
  channelMetaVerificationProof: string
}): boolean {
  const { channelMeta, channelMetaVerificationProof, channel } = data
  try {
    const channelComponents = convertCaipToObject(channel)
    const messageSigner = verifyEip712ProofV2(
      channelMetaVerificationProof.split(':')[1],
      JSON.stringify(channelMeta),
      channelComponents.result.chainId,
      config.MAP_ID_TO_COMM_CONTRACT[channelMetaVerificationProof.split(':')[1]]
    )
    return messageSigner.toString().toLowerCase() == channelComponents.result.address.toLowerCase()
  } catch (error) {
    return false
  }
}

export default class ChannelPrecache {
  constructor(@Inject('logger') private logger) {}

  public async addChannelMeta(channelMeta: channelPrecacheInput) {
    if (!validateChannelMetaSiganture(channelMeta)) {
      throw new Error('Signature verification failed!!')
    }
    const query = `INSERT INTO channel_precache (channel, channel_meta, channel_meta_verification_proof) VALUES (?,?,?)`
    return await new Promise(async (resolve, reject) => {
      db.query(
        query,
        [
          channelMeta.channel,
          JSON.stringify(channelMeta.channelMeta),
          channelMeta.channelMetaVerificationProof
        ],
        (err, res) => {
          if (err) {
            this.logger.error(err)
            return reject(err)
          } else {
            return resolve(true)
          }
        }
      )
    })
  }

  public async getChannelMeta(channel: string): Promise<channelPrecacheOutput | null> {
    const query = `SELECT channel, channel_meta FROM channel_precache WHERE channel = ?`

    try {
      const results: any[] = await new Promise((resolve, reject) => {
        db.query(query, [channel], (err, res) => {
          if (err) {
            this.logger.error(err)
            return reject(err)
          }
          resolve(res)
        })
      })
      if (results.length === 0) {
        return null
      }
      const { channel: resultChannel, channel_meta } = results[0]
      const channelMeta = typeof channel_meta === 'string' ? JSON.parse(channel_meta) : channel_meta
      return {
        channel: resultChannel,
        channelMeta
      }
    } catch (error) {
      console.error('Database error:', error)
      throw error
    }
  }

  public async _deleteChannel(channel: string) {
    // IMPORTANT: THIS CALL IS RESTRICTED FOR TEST CASES ONLY //
    restrictAPICall('/tests/', '/src/')

    // Call private method
    await this.deletePreChannel(channel)
  }

  public async _bulkDeletePreChannelRecord() {
    restrictAPICall('/tests/', '/src/')

    await this.bulkDeletePreChannelRecord()
  }

  private async bulkDeletePreChannelRecord() {
    const logger = this.logger
    const timestamp = new Date().getTime() / 1000
    const query = `DELETE from channel_precache where timestamp IS NOT NULL AND ${timestamp}-UNIX_TIMESTAMP(timestamp) > 3600 ?`
    return await new Promise((resolve, reject) => {
      db.query(query, function (error, results) {
        if (error) {
          return reject(error)
        } else {
          logger.info('Completed bulkDeletePreChannelRecord()')
          resolve(true)
        }
      })
    })
  }

  private async deletePreChannel(channel: string) {
    const logger = this.logger
    const query = 'DELETE from channel_precache where channel = ?'
    return await new Promise((resolve, reject) => {
      db.query(query, [channel], function (error, results) {
        if (error) {
          return reject(error)
        } else {
          logger.info('Completed deleteChannel() for Channel: %s', channel)
          resolve(true)
        }
      })
    })
  }
}
