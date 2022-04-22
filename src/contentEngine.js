const Logger = require('./logger')
const logging = new Logger('chiron-client')
const fs = require('fs')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

const ENGINE_STATES = {
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  NOCONTENT: 'NOCONTENT'
}

class ContentEngine {
  constructor () {
    this.state = ENGINE_STATES.NOCONTENT
  }

  async init (document) {
    logging.debug('#init')
    this.document = document
    return this.processNextChunk()
  }

  async processNextChunk () {
    if (this.document.length === 0) {
      this.currentChunk = {
        finalChunk: true,
        text: "<h1>End</h1><p>You've reached the end of this document and have covered all of the content, well done!</p>\n"
      }
    }

    if (this.completedChunks) {
      if (this.currentChunk.finalChunk) {
        this.completedChunks[0].endTime = Date.now()
        this.state = ENGINE_STATES.DONE
        return
      }

      this.completedChunks[0].endTime = Date.now()
      this.completedChunks.unshift({
        startTime: Date.now(),
        commandAttempts: []
      })
    } else {
      this.completedChunks = [{
        startTime: Date.now(),
        commandAttempts: []
      }]
    }

    logging.debug('#processNextChunk')
    logging.debug('State Change: Processing')
    logging.info('Processing Next Chunk')
    this.state = ENGINE_STATES.PROCESSING

    this.currentChunk = this.document.shift()

    logging.debug(`Document is ${JSON.stringify(this.document)}`)

    this.currentChunk.assets?.forEach(asset => {
      fs.writeFileSync(`./static/${asset.name}`, asset.image, 'base64')
    })

    const processingPromises = []
    this.currentChunk.preCommands.forEach(async command => {
      // Handle APPLY preCommands
      if (command.method === 'APPLY') {
        logging.debug('Writing file content to disk')
        fs.writeFileSync(command.content.name, command.content.value)

        /* istanbul ignore next */
        try {
          if (!process.env.npm_command) {
            logging.error(JSON.stringify(command))
            processingPromises.push(exec(`kubectl apply -f ${command.content.name}`))
          }
        } catch (error) {
          logging.error(`Configuration Error: ${error}`)
        }
      }

      if (command.method === 'INCLUDEFILE') {
        logging.debug('Writing included file content to disk')
        fs.writeFileSync(`/host/${command.content.name}`, command.content.value)
      }

      if (command.method === 'WAIT') {
        processingPromises.push(this.meetsResourceRequirements(
          command.kind,
          command.namespace,
          command.value,
          command.equalityOperator,
          command.target,
          true
        ))
      }

      /* istanbul ignore next */
      if (command.method === 'EXECCOMMAND') {
        processingPromises.push(exec(command.value, { cwd: '/host/' }))
      }
    })

    await Promise.all(processingPromises)
    logging.debug('State Change: Done')
    this.state = ENGINE_STATES.DONE
  }

  async checkChunkConditions (command, commandOutput) {
    async function shouldProcessNextChunk (self) {
      self.currentChunk.postChecks.shift()
      if (self.currentChunk.postChecks.length === 0) {
        await self.processNextChunk()
        return true
      }
      return false
    }

    if (this.state !== ENGINE_STATES.DONE || !this.currentChunk || this.currentChunk.finalChunk) {
      return
    }

    if (command) {
      this.completedChunks[0].commandAttempts.push(command)
    }

    if (this.currentChunk.postChecks[0]?.method === 'COMMANDWAIT' && command) {
      logging.debug(`Command is ${command}, looking for ${this.currentChunk.postChecks[0]?.value}`)
      const commandMatch = this.currentChunk.postChecks[0]?.value.replaceAll('*', '.*')
      if (command.match(commandMatch)) {
        return shouldProcessNextChunk(this)
      }
    }

    if (this.currentChunk.postChecks[0]?.method === 'CHECKCOMMANDOUT' && commandOutput) {
      if (commandOutput.includes(this.currentChunk.postChecks[0].value)) {
        return shouldProcessNextChunk(this)
      }
    }

    return false
  }

  getHtmlContent () {
    if (this.state === ENGINE_STATES.DONE) {
      return this.currentChunk.text
    }
  }

  async executeCommand (command) {
    try {
      const newContent = await this.checkChunkConditions(command)

      /* istanbul ignore next */
      logging.debug(newContent ? 'Call me back for new content' : 'There is no new content')

      // Due to the way we have to import ChildProcess and then Promisify it
      // (because it's still working with CallBacks *sigh*) we check if we're
      // being run as part of the test harness and then skip if we are, this is
      // a hack but it's 2022 and child_process is still using CallBacks.
      /* istanbul ignore next */
      if (process.env.npm_command !== 'test') {
        try {
          const { stdout } = await exec(command, { cwd: '/host/' })
          await this.checkChunkConditions(undefined, stdout)
          return {
            newContent,
            commandOutput: stdout
          }
        } catch (error) {
          return {
            newContent,
            commandOutput: `${error.stderr}\n${error.stdout}`
          }
        }
      } else {
        logging.error('RUNNING IN TEST MODE, THIS SHOULD NOT BE SEEN IN PROD')
        logging.error('RUNNING IN TEST MODE, THIS SHOULD NOT BE SEEN IN PROD')
        logging.error('RUNNING IN TEST MODE, THIS SHOULD NOT BE SEEN IN PROD')
        logging.error('RUNNING IN TEST MODE, THIS SHOULD NOT BE SEEN IN PROD')
        return
      }
    } catch (error) {
      logging.error(error)
    }
  }
}

module.exports = {
  ContentEngine,
  ENGINE_STATES
}
