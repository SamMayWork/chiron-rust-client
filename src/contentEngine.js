// const KubeProcessor = require('./kubeProcessor')

const Logger = require('./logger')
const logging = new Logger('chiron-client')
const fs = require('fs')
const { KubeChecker } = require('./kubeChecker')

const ENGINE_STATES = {
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  NOCONTENT: 'NOCONTENT'
}

class ContentEngine {
  constructor () {
    this.state = ENGINE_STATES.NOCONTENT
    this.kubeChecker = new KubeChecker()
  }

  async init (document) {
    logging.debug('#init')
    this.document = document
    return this.processNextChunk()
  }

  async processNextChunk () {
    if (this.completedChunks) {
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

    this.currentChunk.preCommands.forEach(command => {
      if (command.content) {
        logging.debug('Writing file content to disk')
        fs.writeFileSync(command.content.name, command.content.value)
      }
    })

    logging.debug('State Change: Done')
    this.state = ENGINE_STATES.DONE
  }

  async checkChunkConditions (command) {
    async function shouldProcessNextChunk (self) {
      self.currentChunk.postChecks.shift()
      if (self.currentChunk.postChecks.length === 0) {
        await self.processNextChunk()
        return true
      }
      return false
    }

    if (command) {
      this.completedChunks[0].commandAttempts.push(command)
    }

    if (this.state === ENGINE_STATES.NOCONTENT || !this.currentChunk) {
      return
    }

    if (this.currentChunk.postChecks[0]?.method === 'WAIT') {
      const resources = await this.kubeChecker.getByResourceType(this.currentChunk.postChecks[0].kind, this.currentChunk.postChecks[0].namespace)

      if (this.currentChunk.postChecks[0]?.target) {
        resources.body.filter(resource => {
          return resource.includes(this.currentChunk.postChecks[0]?.target)
        })
      }

      switch (this.currentChunk.postChecks[0]?.equalityOperator) {
        case 'EQUALS': {
          if (resources.body.length === this.currentChunk.postChecks[0].value) {
            return shouldProcessNextChunk(this)
          }
          break
        }
        case 'GREATERTHAN': {
          if (resources.body.length >= this.currentChunk.postChecks[0].value) {
            return shouldProcessNextChunk(this)
          }
          break
        }
        case 'LESSTHAN': {
          if (resources.body.length <= this.currentChunk.postChecks[0].value) {
            return shouldProcessNextChunk(this)
          }
          break
        }
        default:
          logging.error('Could not match command Equality Operator')
      }
    }

    if (this.currentChunk.postChecks[0]?.method === 'COMMANDWAIT') {
      logging.debug(`Command is ${command}, looking for ${this.currentChunk.postChecks[0]?.value}`)
      if (this.currentChunk.postChecks[0]?.value === command) {
        this.currentChunk.postChecks.shift()

        if (this.currentChunk.postChecks.length === 0) {
          await this.processNextChunk()
          return true
        }
      }
    }
    return false
  }

  getHtmlContent () {
    if (this.state === ENGINE_STATES.DONE) {
      return this.currentChunk.text
    }
  }
}

module.exports = {
  ContentEngine,
  ENGINE_STATES
}
