const util = require('util')
const exec = util.promisify(require('child_process').exec)

function runCommand (command) {
  return exec(command)
}

module.exports = {
  runCommand
}