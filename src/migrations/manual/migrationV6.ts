import Container from 'typedi'
import { Logger } from 'winston'

import { convertCaipToObject, isValidCAIP } from '../../helpers/caipHelper'
import * as db from '../../helpers/dbHelper'
import { IPFSClient } from '../../helpers/ipfsClient'

export const checkChannelMigration = async () => {
  /**
   * MIGRATION PLAN
   * 1. Read ipfs hash from channels table
   * 2. Fetch data from ipfs
   * 3. UCompare it with data present in db
   *
   * ERROR DETECTION
   * To check No. of records with payload_migration as 0 - NOT RESOLVED
   * To check No. of records with payload_migration as -1 - NOT MATCHED
   */
  const channelAndHash = await getChannelData()

  for (const channelPayload of channelAndHash) {
    const { channel, ipfshash, name, info, url, iconV2, alias_address } = channelPayload
    try {
      const ipfsObject: { [x: string]: any } = await IPFSClient.get(ipfshash)

      let chainId: string = ''
      let address: string = ''
      let caip: string = ''

      if (isValidCAIP(alias_address)) {
        chainId = convertCaipToObject(alias_address).result.chainId
        address = convertCaipToObject(alias_address).result.address
        caip = `eip155:${chainId}`
      }

      const dbChannelPayload1 = {
        name,
        info,
        url,
        icon: iconV2,
        aliasDetails: alias_address && alias_address !== 'NULL' ? { [`${caip}`]: address } : {}
      }

      const dbChannelPayload2 = {
        name,
        info,
        url,
        icon: iconV2,
        blockchain: chainId,
        address: address
      }

      const dbChannelPayload3 = {
        name,
        info,
        url,
        icon: iconV2
      }

      const dbChannelPayload4 = {
        name,
        info,
        url,
        icon: iconV2,
        blockchain: chainId === '80001' ? 'POLYGON_TEST_MUMBAI' : 'POLYGON_MAINNET',
        chain_id: chainId,
        address: address
      }

      // Bug in Alias Address
      const dbChannelPayload5 = {
        name,
        info,
        url,
        icon: iconV2,
        // DUE TO PROD BUG
        blockchain: chainId === '137' ? 'POLYGON_TEST_MUMBAI' : 'POLYGON_MAINNET',
        // DUE TO PROD BUG
        chain_id: chainId === '137' ? '80001' : '137',
        address: address
      }

      // When user passed invalid alias address
      const dbChannelPayload6 = {
        name,
        info,
        url,
        icon: iconV2,
        // DUE TO PROD BUG
        blockchain: 'POLYGON_TEST_MUMBAI',
        // DUE TO PROD BUG
        chain_id: '80001',
        address: ipfsObject['address']
      }

      if (
        JSON.stringify(ipfsObject) !== JSON.stringify(dbChannelPayload1) &&
        JSON.stringify(ipfsObject) !== JSON.stringify(dbChannelPayload2) &&
        JSON.stringify(ipfsObject) !== JSON.stringify(dbChannelPayload3) &&
        JSON.stringify(ipfsObject) !== JSON.stringify(dbChannelPayload4) &&
        JSON.stringify(ipfsObject) !== JSON.stringify(dbChannelPayload5) &&
        JSON.stringify(ipfsObject) !== JSON.stringify(dbChannelPayload6)
      ) {
        console.log('-------------------')
        console.log(ipfsObject)
        console.log('\n\n')
        console.log(dbChannelPayload1)
        console.log('-------------------')
        await updateChannelPayloadMigration(-1, channel)
      } else {
        await updateChannelPayloadMigration(1, channel)
      }
    } catch (e) {
      const Logger: Logger = Container.get('logger')
      Logger.warn(`Error fetching ipfsHash for channel ${channel}`)
    }
  }
}

const getChannelData = async () => {
  const query = `SELECT channel, ipfshash, name, info, url, iconV2, alias_address FROM channels where payload_migration != 1`
  const channelAndHash: {
    channel: string
    ipfshash: string
    name: string
    info: string
    url: string
    iconV2: string
    alias_address: string
  }[] = await new Promise((resolve, reject) => {
    ;(db as any).query(query, [], (err: any, results: any) => {
      if (err) return reject(err)
      resolve(results)
    })
  })
  return channelAndHash
}

const updateChannelPayloadMigration = async (payloadMigration: -1 | 1, channel: string) => {
  const query = `UPDATE channels SET payload_migration = ? WHERE channel = ?`
  await new Promise((resolve, reject) => {
    ;(db as any).query(query, [payloadMigration, channel], (err: any) => {
      if (err) return reject(err)
      resolve(true)
    })
  })
}
