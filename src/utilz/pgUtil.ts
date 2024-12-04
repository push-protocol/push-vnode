import { IDatabase } from 'pg-promise'
import pg from 'pg-promise/typescript/pg-subset'
import { Logger } from 'winston'

import { EnvLoader } from './envLoader'
import { StrUtil } from './strUtil'
import { WinstonUtil } from './winstonUtil'

// PG PROMISE https://github.com/vitaly-t/pg-promise

// NOTE: here are how named params are working in pg-async
// https://github.com/vitaly-t/pg-promise/wiki/Learn-by-Example#named-parameters
export class PgUtil {
  private static log: Logger = WinstonUtil.newLog('pg')
  static logSql = false
  static pool: IDatabase<{}, pg.IClient> // todo unknown type ???

  public static init(pool: IDatabase<{}, pg.IClient>) {
    PgUtil.pool = pool
    if (!PgUtil.logSql && EnvLoader.getPropertyAsBool('LOG_SQL_STATEMENTS')) {
      // todo add logging query + values
      PgUtil.logSql = true
    }
    this.log.info('sql statement logging is enabled')
  }

  public static async queryOneValueOrDefault<V>(
    query: string,
    defaultValue: V,
    ...sqlArgs: any[]
  ): Promise<V | null> {
    const result = await this.queryOneRow(query, ...sqlArgs)
    if (result == null) {
      return defaultValue
    }
    const firstPropertyName = Object.entries(result)[0][0]
    if (firstPropertyName == null) {
      return defaultValue
    }
    const resultValue = result[firstPropertyName]
    if (resultValue == null) {
      return defaultValue
    }
    return resultValue
  }

  public static async queryOneValue<V>(query: string, ...sqlArgs: any[]): Promise<V | null> {
    return await this.queryOneValueOrDefault(query, null, ...sqlArgs)
  }

  public static async queryOneRow<R>(query: string, ...sqlArgs: any[]): Promise<R | null> {
    const result = await this.queryArr<R>(query, ...sqlArgs)
    if (result.length != 1) {
      return null
    }
    return result[0]
  }

  public static async queryAnyArr(query: string, ...sqlArgs: any[]): Promise<any[]> {
    return await this.queryArr<any>(query, ...sqlArgs)
  }

  public static async update(query: string, ...sqlArgs: any[]): Promise<number> {
    query = this.replaceAllMySqlToPostre(query)
    this.log.debug(query, '     ---> args ', sqlArgs)
    const result = await this.pool.result(query, sqlArgs, (r) => r.rowCount)
    return result
  }

  public static async insert(query: string, ...sqlArgs: any[]): Promise<number> {
    query = this.replaceAllMySqlToPostre(query)
    this.log.debug(query, '     ---> args ', sqlArgs)
    const result = await this.pool.result(query, sqlArgs, (r) => r.rowCount)
    return result
  }

  public static async queryArr<R>(query: string, ...sqlArgs: any[]): Promise<R[]> {
    query = this.replaceAllMySqlToPostre(query)
    this.log.debug(query, '     ---> args ', sqlArgs)
    const result = await this.pool.query<R[]>(query, sqlArgs)
    return result
  }

  /**
   * replaces MySql placeholders ? with Postre placehoslers $1 $2 $3
   * example:
   * aaaa?bbbb?cccc? => aaaa$1bbbb$2cccc$3
   */
  public static replaceAllMySqlToPostre(s: string): string {
    let cnt = 1
    return s.replace(/\?/g, function () {
      return `$${cnt++}`
    })
  }
}