/*

Prints a progressbar which looks like this:

Total progress   [█████████████████___] 86 %
 */
import chalk from 'chalk'
import { clearInterval } from 'timers'

import { printProgress } from '../helpers/progressBarHelper'
const readline = require('readline')

const consoleHolderLog = console.log
const consoleHolderInfo = console.info
const consoleHolderWarn = console.warn

export interface DynamicLoggerI {
  title: string
  progress?: number
  total?: number
  append?: string
  chalkIt?: string
}

export class DynamicLogger {
  private titleObj: DynamicLoggerI = null
  private braile: string = '⣾'
  private arrayOfLogs: DynamicLoggerI[] = null
  private footerLogs: DynamicLoggerI = null

  private padding: number = 0

  private running: boolean = false
  private loaderInterval: null | ReturnType<typeof setTimeout> = null
  private disabled: boolean = false

  constructor(
    titleObj: DynamicLoggerI = null,
    arrayOfLogs: DynamicLoggerI[] = [],
    footerLogs: DynamicLoggerI = null
  ) {
    this.titleObj = titleObj
    this.arrayOfLogs = arrayOfLogs
    this.footerLogs = footerLogs
  }

  public startRendering(logger) {
    this.running = true

    // hijack console
    console.log = function (text) {
      logger.info(text)
    }

    console.info = function (text) {
      logger.info(text)
    }

    console.warn = function (text) {
      logger.warn(text)
    }

    // Don't override this
    // console.error = function(text) {
    //   logger.error(text);
    // };

    clearInterval(this.loaderInterval)
    this._loaderChanger()
  }

  public stopRendering(finisher: string = '✔️  ') {
    clearInterval(this.loaderInterval)
    this.braile = finisher
    this._renderLogs(true)
    this.running = false

    // release console
    console.log = consoleHolderLog
    console.info = consoleHolderInfo
    console.warn = consoleHolderWarn
  }

  public updateTitle(titleObj: DynamicLoggerI) {
    this._clearLogs()
    this.titleObj = titleObj
    this._renderLogs(false)
  }

  public updateEntireLogs(logs: DynamicLoggerI[]) {
    this._clearLogs()
    this.arrayOfLogs = logs
    this._renderLogs(false)
  }

  public updateLogs(lineNumber: number, logObject: DynamicLoggerI): void {
    this._clearLogs()
    if (!this.arrayOfLogs) {
      this.arrayOfLogs = []
    }

    if (this.arrayOfLogs.length > lineNumber) {
      // Replace the log
      this.arrayOfLogs[lineNumber] = logObject
    } else {
      // Extend the array
      for (let log = this.arrayOfLogs.length; log <= lineNumber; log++) {
        if (log == lineNumber) {
          this.arrayOfLogs[log] = logObject
        } else {
          this.arrayOfLogs[log] = { title: '' }
        }
      }
    }

    this._renderLogs(false)
  }

  public updateFooterLogs(info: string) {
    this._clearLogs()
    this.footerLogs = { title: info }
    this._renderLogs(false)
  }

  public updatePadding(padding: number) {
    this._clearLogs()
    this.padding = padding
    this._renderLogs(false)
  }

  public reset() {
    this.titleObj = null
    this.arrayOfLogs = []
    this.footerLogs = null
    this.padding = 0
  }

  public clearLogs() {
    this._clearLogs()
  }

  public setDisabled(value) {
    this.disabled = value
  }

  public isDisabled() {
    return this.disabled
  }

  private async _loaderChanger() {
    this._renderLogs(false)

    // Set change interval
    this.loaderInterval = setInterval(() => {
      if (!this.running) return

      // Add loader bar | ⣾⣽⣻⢿⡿⣟⣯⣷
      switch (this.braile) {
        case '⣾':
          this.braile = '⣽'
          break
        case '⣽':
          this.braile = '⣻'
          break
        case '⣻':
          this.braile = '⢿'
          break
        case '⢿':
          this.braile = '⡿'
          break
        case '⡿':
          this.braile = '⣟'
          break
        case '⣟':
          this.braile = '⣯'
          break
        case '⣯':
          this.braile = '⣷'
          break
        default:
          this.braile = '⣾'
          break
      }

      this._renderLogs(true)
    }, 200)
  }

  private _renderLogs(clearLogs: boolean, forced: boolean = false) {
    if (!this.running && !forced) {
      return
    }

    if (clearLogs) {
      this._clearLogs(forced)
    }

    if (this.titleObj) {
      process.stdout.write(this._formattedLogObject(this.titleObj, true, false) + '\n')
    }

    if (this.arrayOfLogs) {
      for (let log = 0; log < this.arrayOfLogs.length; log++) {
        process.stdout.write(this._formattedLogObject(this.arrayOfLogs[log], false, false) + '\n')
      }
    }

    if (this.footerLogs) {
      process.stdout.write(this._formattedLogObject(this.footerLogs, false, true) + '\n')
    }
  }

  private _formattedLogObject(log: DynamicLoggerI, isTitle: boolean, isFooter: boolean) {
    let output = this._expandedLogString(log, isTitle, isFooter)

    if ('chalkIt' in log) {
      const split = log.chalkIt.split('.')
      let chalkFunc = chalk
      for (let i = 0; i < split.length; i++) {
        chalkFunc = chalkFunc[`${split[i]}`]
      }

      output = chalkFunc(output)
    } else {
      output = chalk.white(output)
    }

    return output
  }

  private _expandedLogString(log: DynamicLoggerI, isTitle: boolean, isFooter: boolean) {
    if (!log.title) {
      log = { title: '' }
    }

    let output = log.title
    if (isTitle) {
      output = `${this.braile} ${output}`
    }

    if (isFooter) {
      let footerTitle = ''
      const split = log.title.split('\n')
      for (let i = 0; i < split.length; i++) {
        split[i] = ' '.repeat(this.padding) + split[i]
      }

      footerTitle = split.join('\n')
      if (footerTitle) {
        output = `-----------------------------------------------\n${' '.repeat(
          this.padding
        )}${chalk.inverse.white.bold('  ADDITIONAL LOGS  ')}\n${footerTitle}`
      }
    }

    if ('progress' in log && 'total' in log) {
      output = printProgress(log.progress, log.total, log.title, log.append)
    }

    if (this.padding != 0) {
      output = ' '.repeat(this.padding) + output
    }

    return output
  }

  private async _clearLogs(forced: boolean = false) {
    if (!this.running && !forced) {
      return
    }

    if (!this.arrayOfLogs && !this.titleObj && !this.footerLogs) {
      return
    }

    let addedCount = 0
    if (this.titleObj != null) {
      addedCount =
        addedCount +
        this._calcTotalTerminalLines(this._expandedLogString(this.titleObj, true, false))
    }

    if (this.footerLogs != null) {
      // Special case, somehow footerlogs add 20 characters extra so adjusting
      const string = this._expandedLogString(this.footerLogs, false, true)
      const newString = string.substring(0, string.length - 20)

      const addedLines = this._calcTotalTerminalLines(newString)
      addedCount = addedCount + addedLines
    }

    for (let i = 0; i < this.arrayOfLogs.length; i++) {
      const addedLines = this._calcTotalTerminalLines(
        this._expandedLogString(this.arrayOfLogs[i], false, false)
      )
      addedCount = addedCount + addedLines
    }

    for (let i = 0; i < addedCount + 1; i++) {
      //first clear the current line, then clear the previous line
      const y = i === 0 ? 0 : -1
      readline.moveCursor(process.stdout, 0, y)
      readline.clearLine(process.stdout, 0)
    }
    readline.cursorTo(process.stdout, 0)
  }

  private _calcTotalTerminalLines(title: string, offset: number = 0) {
    let terminalLines = -1

    const split = title.split('\n')
    for (let i = 0; i < split.length; i++) {
      terminalLines++
      terminalLines = terminalLines + this._calcNumTerminalLinesPerTitle(split[i], offset)
    }

    if (split.length > 1) {
      terminalLines = terminalLines - split.length + 1
    }

    // break into new lines first
    return terminalLines
  }

  private _calcNumTerminalLinesPerTitle(title: string, offset: number) {
    let len = title.length
    if (len > process.stdout.columns) {
      len = len - offset
    }

    return Math.ceil(len / process.stdout.columns)
  }
}

const DynamicLoggerInstance = new DynamicLogger()
export default DynamicLoggerInstance
