import * as db from './dbHelper'

export interface ProtocolMetaI {
  type: string
  value: string
}

// GET PROTOCOL META VALUES
export const getProtocolMetaValues = async (
  forTypes: string[],
  offsetPadding: number = 0,
  logger
) => {
  return await new Promise((resolve, reject) => {
    if (forTypes.length == 0) {
      const err = 'ForTypes array is empty'
      logger.error(`Error in getProtocolMetaValues(): ${err}`)
      reject(`Error in getProtocolMetaValues() with err: ${err}`)
    }

    let rowsQuery = ``
    for (let i = 0; i < forTypes.length; i++) {
      rowsQuery += `type="${forTypes[i]}"`

      if (i < forTypes.length - 1) {
        rowsQuery += ' OR '
      }
    }

    const query = `SELECT * FROM protocol_meta WHERE ${rowsQuery};`
    logger.info(
      `Retrieving data from getProtocolMeta() - Searching %d Values`,
      forTypes.length,
      forTypes.join(', ')
    )

    db.query(query, [], function (err, results) {
      if (err) {
        logger.error(`Error in getProtocolMetaValues() | db.query with ${err}`)
        reject(err)
      } else {
        const parsedResArray = JSON.parse(JSON.stringify(results))
        const parsedResults = parsedResArray.reduce(
          (obj, item) => Object.assign(obj, { [item.type]: item.value }),
          {}
        )

        logger.info(`Completed getProtocolMeta() - ${Object.keys(parsedResults).length} matches`)
        resolve(parsedResults)
      }
    })
  })
}

// UPDATE PROTOCOL META VALUES
export const updateProtocolMetaValues = async (
  typeValuePairs: ProtocolMetaI[],
  offsetPadding: number = 0,
  logger
) => {
  return await new Promise(async (resolve, reject) => {
    if (typeValuePairs.length == 0) {
      const err = 'typeValuePairs array is empty'
      logger.error(`Error in updateProtocolMetaValues(): ${err}`)
      reject(`Error in updateProtocolMetaValues() with err: ${err}`)
    }

    let rowsQuery = ``
    for (let i = 0; i < typeValuePairs.length; i++) {
      rowsQuery += `WHEN type="${typeValuePairs[i].type}" THEN "${typeValuePairs[i].value}"`

      if (i < typeValuePairs.length - 1) {
        rowsQuery += ' '
      }
    }

    rowsQuery += ` ELSE value`

    let whereClause = ''
    typeValuePairs.forEach((element, index) => {
      if (index < typeValuePairs.length - 1) {
        whereClause += `"${element.type}", ${whereClause}`
      } else {
        whereClause += `"${element.type}"`
      }
    })

    const query = `UPDATE protocol_meta SET value=CASE ${rowsQuery} END WHERE type IN (${whereClause});`

    logger.info(
      `Retrieving data from updateProtocolMetaValues() - Updating %d Values - %s`,
      typeValuePairs.length,
      typeValuePairs.join(', ')
    )

    // await new Promise(r => setTimeout(r, 15000));
    db.query(query, [], function (err, results) {
      if (err) {
        logger.error(`Error in updateProtocolMetaValues() | db.query with ${err}`)
        reject(err)
      } else {
        logger.info(`Completed updateProtocolMetaValues()`)
        resolve(results)
      }
    })
  })
}
