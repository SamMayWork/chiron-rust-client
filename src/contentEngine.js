// const KubeProcessor = require('./kubeProcessor')

const Logger = require('./logger')
const logging = new Logger('chiron-client')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')

class ContentEngine {
  constructor (rawContent) {
    this.rawContent = rawContent

    this.states = {
      PROCESSING: 'processing',
      DONE: 'done'
    }
    this.state = this.states.PROCESSING

    this.processNextChunk()
  }

  /**
   * Processes the next chunk in the array
   */
  async processNextChunk () {
    logging.debug('State Change: Processing')
    this.state = this.states.PROCESSING

    const currentChunk = this.rawContent.shift()

    this.currentHtml = currentChunk.text
    this.postChecks = currentChunk.postChecks

    currentChunk.preCommands.forEach(command => {
      if (command.content) {
        logging.debug('Writing file content to disk')
        fs.writeFileSync(`./${uuidv4()}.pmcd`, command.content)
      }
    })

    logging.debug('State Change: Done')
    this.state = this.states.DONE
  }

  /**
   * Checks to see if the conditions of the chunk have been met
   * If command is specified, command checks will also be run
   * @param {String} command - Command to be run
   */
  checkChunkConditions (command) {
    logging.debug(`Command is ${command}, looking for ${this.postChecks[0]?.target}`)
    if (this.postChecks[0]?.target === command) {
      this.processNextChunk()
      return true
    }

    return false
  }

  /**
   * Gets the current HTML content to show on the client
   */
  getHtmlContent () {
    return this.state === this.states.DONE ? this.currentHtml : undefined
  }
}

module.exports = ContentEngine
