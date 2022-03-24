const util = require('util')
const exec = util.promisify(require('child_process').exec)
const Logger = require('./logger')
const logging = new Logger('kube-checker')

async function processChunkConditions (checks) {
  const checkPromises = []
  checks.forEach(check => {
    checkPromises.push(module.exports.performCheck(check))
  })

  try {
    const checksMet = await Promise.all(checkPromises)
    return checksMet.every(value => value === true)
  } catch (error) {
    logging.error(error)
  }
}

async function performCheck (check) {
  switch(check.commandKey) {
    // No other command types right now, but this might change
    case 'WAIT': {
      

      break
    }
  }
}

function runCommand (command) {
  return exec(command)
}

module.exports = {
  processChunkConditions,
  performCheck,
  runCommand
}