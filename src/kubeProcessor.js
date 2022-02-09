const util = require('util')
const exec = util.promisify(require('child_process').exec)

const Logger = require('./logger')
const logging = new Logger('command-runner')

function runCommand (command) {
  return exec(command)
}

module.exports = {
  runCommand
}