import Transport from 'winston-transport'
import winston from 'winston'

import { WinstonUtil } from '../utilz/winstonUtil'
import { EnvLoader } from '../utilz/envLoader'
import StrUtil from '../utilz/strUtil'
import { DateTime } from 'ts-luxon'

const moment = require('moment') // time library

class DynamicLoggerTransport extends Transport {
  private dynamicLogging: object = null
  private formatLogInfo: Function = null

  constructor(opts, formatLogInfo) {
    super(opts)
    this.formatLogInfo = formatLogInfo
  }

  public setDynamicLoggerObject(object) {
    this.dynamicLogging = object
  }

  public log(info, callback) {
    setImmediate(() => {
      if (this.dynamicLogging) {
        this.dynamicLogging.updateFooterLogs(this.formatLogInfo(info))
      }
    })

    // Perform the writing to the remote service
    callback()
  }
}

export const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    simulate: 4,
    input: 5,
    saved: 6,
    verbose: 7,
    debug: 8,
    silly: 9
  },
  colors: {
    info: 'green',
    simulate: 'white bold dim',
    input: 'inverse bold',
    saved: 'italic white',
    debug: 'yellow'
  }
}

var options = {
  file: {
    level: 'verbose',
    filename: `${__dirname}/../../logs/app.log`,
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    colorize: true
  }
}

const parser = (param: any): string => {
  if (!param) {
    return ''
  }
  if (typeof param === 'string') {
    return param
  }

  return Object.keys(param).length ? JSON.stringify(param, undefined, 2) : ''
}

const formatLogInfo = (info) => {
  const { timestamp, level, message, meta } = info

  const ts = DateTime.now().toFormat('HH:mm:ss') // fixing incorrect timestamps
  const metaMsg = meta ? `: ${parser(meta)}` : ''

  let CLASS_NAME_LENGTH = 21
  const className = info.className
  let formattedClassName: string
  if (StrUtil.isEmpty(className)) {
    formattedClassName = ' '
  } else {
    formattedClassName = (' [' + className.substring(0, CLASS_NAME_LENGTH) + '] ').padEnd(
      CLASS_NAME_LENGTH + 4
    )
  }
  let paddedLevel = level.padEnd(5, ' ')
  return `${ts} ${paddedLevel}${formattedClassName}  ${parser(message)} ${metaMsg}`
}

const formatter = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf((info) => {
    return formatLogInfo(info)
  }),
  winston.format.colorize({
    all: true
  })
)

export const transports = []
const dynamicLoggingTransport = new DynamicLoggerTransport(
  {
    format: formatter
  },
  formatLogInfo
)

export const consoleTransport = new winston.transports.Console({
  silent: true,
  format: formatter
})

export const jsonLogTransport = new winston.transports.File(options.file)

transports.push(
  // Console should always be at 0 and dynamic log should always be at 2
  // remember and not change it as it's manually baked in hijackLogger
  consoleTransport,
  jsonLogTransport,
  dynamicLoggingTransport
)

if (EnvLoader.getPropertyAsBool('VALIDATOR_DEBUG_LOG')) {
  transports.push(WinstonUtil.debugFileTransport, WinstonUtil.errorFileTransport)
}

const LoggerInstance = winston.createLogger({
  level: EnvLoader.getPropertyOrDefault('LOG_LEVEL', 'debug'),
  levels: customLevels.levels,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports
})

winston.addColors(customLevels.colors)

const hijackLogger = (dynamicLogger) => {
  dynamicLoggingTransport.setDynamicLoggerObject(dynamicLogger)

  let count = 0
  transports.forEach((t) => {
    let silence = false

    if (dynamicLogger) {
      // dynamic logger is on, make console silent
      if (count == 0) {
        silence = true
      }
    } else {
      // dynamic logger is off, make it silent
      if (count == 2) {
        silence = true
      }
    }

    t.silent = silence

    count++
  })
}

LoggerInstance.hijackLogger = hijackLogger

export default LoggerInstance
