import { Container } from 'typedi'
import winston from 'winston'

import config from '../config'

const mysql = require('mysql')

const dbpool = mysql.createPool({
  connectionLimit: 1,
  host: config.dbhost,
  user: config.dbuser,
  password: config.dbpass
})

const pool = mysql.createPool({
  connectionLimit: 50,
  host: config.dbhost,
  user: config.dbuser,
  password: config.dbpass,
  database: config.dbname,
  charset: config.charset,
  // todo for migrationV42.ts, consider making a separate pool with multipleStatements=true
  multipleStatements: true
})

module.exports = {
  pool,
  dbquery: function () {
    const Logger: any = Container.get('logger')

    let sql_args = []
    const args = []
    for (let i = 0; i < arguments.length; i++) {
      args.push(arguments[i])
    }

    const callback = args[args.length - 1] //last arg is callback
    dbpool.getConnection(function (err, connection) {
      if (err) {
        Logger.error(err)

        return callback(err)
      }

      if (args.length > 2) {
        sql_args = args[1]
      }

      connection.query(args[0], sql_args, function (err, results) {
        connection.release() // always put connection back in pool after last query

        if (err) {
          Logger.error(err)

          return callback(err)
        }

        callback(null, results)
      })
    })
  },
  query: function () {
    const Logger: winston.Logger = Container.get('logger')

    let sql_args = []
    const args = []
    for (let i = 0; i < arguments.length; i++) {
      args.push(arguments[i])
    }

    const callback = args[args.length - 1] //last arg is callback
    pool.getConnection(function (err, connection) {
      if (err) {
        Logger.error(err)

        return callback(err)
      }

      if (args.length > 2) {
        sql_args = args[1]
      }

      connection.query(args[0], sql_args, function (err, results) {
        connection.release() // always put connection back in pool after last query

        if (err) {
          Logger.error(err)

          return callback(err)
        }

        callback(null, results)
      })
    })
  },
  beginTransaction: () => {
    return new Promise((resolve, reject) => {
      pool.getConnection((err, connection) => {
        if (err) return reject(err)
        connection.beginTransaction((err) => {
          if (err) {
            connection.release()
            return reject(err)
          }
          resolve(connection)
        })
      })
    })
  },

  commit: (connection) => {
    return new Promise<void>((resolve, reject) => {
      connection.commit((err) => {
        if (err) {
          connection.rollback(() => {
            connection.release()
            reject(err)
          })
        } else {
          connection.release()
          resolve()
        }
      })
    })
  },

  rollback: (connection) => {
    return new Promise<void>((resolve) => {
      connection.rollback(() => {
        connection.release()
        resolve()
      })
    })
  }
}
