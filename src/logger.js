const chalk = require('chalk')

class Logger {
  constructor (logPrefix) {
    this.logPrefix = logPrefix
  }

  info (message) {
    console.log(`${this.logPrefix}/${chalk.bgGreen.black('info')} : ${message}`)
  }

  debug (message) {
    console.log(`${this.logPrefix}/${chalk.bgGray('debug')} : ${message}`)
  }

  error (message) {
    console.log(`${this.logPrefix}/${chalk.bgRed('error')} : ${message}`)
  }
}

module.exports = Logger
