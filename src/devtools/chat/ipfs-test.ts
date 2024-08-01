import dotenv from 'dotenv'
dotenv.config()
import { CID } from 'ipfs-http-client'
import { create } from 'ipfs-http-client'
import * as mysql from 'mysql'
const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
}
const connection = mysql.createConnection(connectionConfig)
connection.connect(async (error) => {
  if (error) {
    console.error('Error connecting to the database:', error)
    return
  }
  console.log('Connected to the MySQL database')
  const db = connection
  const ipfsClient = create({ url: 'http://localhost:5001' })
  const upgradeScript = async (): Promise<boolean> => {
    return new Promise(async (resolve, reject) => {
      const limit = 5000
      let offset = 0
      let cidCount = 0
      const selectQuery = 'SELECT threadhash from w2w where threadhash is NOT NULL LIMIT ? OFFSET ?'
      let moreResults = true
      const processResults = async () => {
        try {
          const results: [
            {
              threadhash: string
            }
          ] = await new Promise((resolve, reject) => {
            db.query(
              selectQuery,
              [limit, offset],
              function (
                err: any,
                results: [
                  {
                    threadhash: string
                  }
                ]
              ) {
                if (err) {
                  console.log(err)
                  reject(err)
                } else {
                  if (results.length === 0) {
                    moreResults = false
                  }
                  resolve(results)
                }
              }
            )
          })
          for (const _item of results) {
            if (_item.threadhash == null) {
              continue
            }

            let cid = _item.threadhash.trim()
            let count = 0
            while (cid != null) {
              try {
                if (cid && cid.length > 0) {
                  const cidObject: CID = CID.parse(cid)
                  const message = (
                    await ipfsClient.dag.get(cidObject, {
                      timeout: 100
                    })
                  ).value
                  console.log(cid)
                  console.log(message)
                  cid = message.link
                  count++
                  console.log('iteration count ' + count)
                }
              } catch (err) {
                console.error(err)
                console.log('failed to fetch for : ' + cid)
                cid = null
              }
              cidCount++
              console.log(' cidCount .. ' + cidCount)
            }
            count = 0
          }
          return moreResults
        } catch (err) {
          console.log(err)
          reject(err)
        }
      }
      while (moreResults) {
        moreResults = await processResults()
        offset += limit
      }
      resolve(true)
    })
  }
  try {
    await upgradeScript()
    console.log('Script done')
  } catch (error) {
    console.error('Error running upgrade script:', error)
  } finally {
    connection.end()
  }
})
