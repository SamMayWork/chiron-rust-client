const Logger = require('./logger')
const logging = new Logger('chiron-client')
const fs = require('fs')
const { KubeChecker } = require('./kubeChecker')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const { setTimeout } = require('timers/promises')

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
        processingPromises.push(exec(command.value))
      }
    })

    await Promise.all(processingPromises)
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

    if (this.state !== ENGINE_STATES.DONE || !this.currentChunk || this.currentChunk.finalChunk) {
      return
    }

    if (command) {
      this.completedChunks[0].commandAttempts.push(command)
    }

    if (this.currentChunk.postChecks[0]?.method === 'CHECK') {
      const meetsWaitRequirements = await this.meetsResourceRequirements(
        this.currentChunk.postChecks[0].kind,
        this.currentChunk.postChecks[0].namespace,
        this.currentChunk.postChecks[0].value,
        this.currentChunk.postChecks[0].equalityOperator,
        this.currentChunk.postChecks[0].target
      )

      if (meetsWaitRequirements) {
        return shouldProcessNextChunk(this)
      }
    }

    if (this.currentChunk.postChecks[0]?.method === 'COMMANDWAIT') {
      logging.debug(`Command is ${command}, looking for ${this.currentChunk.postChecks[0]?.value}`)
      if (this.currentChunk.postChecks[0]?.value === command) {
        return shouldProcessNextChunk(this)
      }
    }
    return false
  }

  /**
   * Checks if the resources in the cluster satisfy the passed requirements
   * @param {String} kind - Kind of object (DEPLOYMENT, POD, SERVICE, etc)
   * @param {String} namespace - Namespace to check
   * @param {Number} value - Number for equivalence check
   * @param {String} equalityOperator - Compairson Operator (EQUALS, LESSTHAN, GREATERTHAN)
   * @param {String} name - Optional, for string matching the name
   * @param {Boolean} blockUntilTrue - Stops the promise from resolving until the criteria is met
   * @returns Boolean depending on whether the criteria is met
   */
  async meetsResourceRequirements (kind, namespace, value, equalityOperator, name = '', blockUntilTrue = false) {
    while (true) {
      const resources = await this.kubeChecker.getByResourceType(kind, namespace)
      logging.info(`Resources responses was: ${JSON.stringify(resources)}`)

      let checksMet = true

      if (resources.length === 0 && value === 0) {
        return true
      } else if (resources.length === 0) {
        checksMet = false
      }

      if (name && checksMet) {
        resources.filter(resource => {
          return resource.includes(name)
        })
      }

      switch (equalityOperator) {
        case 'EQUALS': {
          if (resources.length !== value) {
            checksMet = false
          }
          break
        }
        case 'GREATERTHAN': {
          if (resources.length < value) {
            checksMet = false
          }
          break
        }
        case 'LESSTHAN': {
          if (resources.length > value) {
            checksMet = false
          }
          break
        }
        default:
          logging.error('Could not match command Equality Operator')
          return
      }

      if (checksMet === true) {
        return checksMet
      } else if (!blockUntilTrue) {
        return false
      }

      // Wait and then try again
      await setTimeout(200)
    }
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
