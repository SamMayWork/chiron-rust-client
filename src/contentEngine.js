// const KubeProcessor = require('./kubeProcessor')

class ContentEngine {
  states = {
    PROCESSING: 'processing',
    DONE: 'done'
  }

  constructor (content) {
    this.content = content

    this.processNextChunk()
  }

  /**
   * Processes the next chunk in the array
   */
  processNextChunk() {
    this.state = this.states.PROCESSING
    const self = this

    const currentChunk = this.content[0]
    this.currentHtmlContent = currentChunk.text

    const commandPromises = []
    currentChunk.preCommands.forEach(command => {
      commandPromises.push(longTime())
    })

    Promise.all(commandPromises)
      .then(() => {
        self.state = self.states.DONE
      })
  }

  /**
   * Checks to see if the post conditions of the chunk have been met
   */
  checkChunkConditions (command) {
    return true
  }

  /**
   * Gets the current HTML content to show on the client
   */
  getHtmlContent () {
    return this.state === this.states.DONE ? this.currentHtmlContent : undefined
  }
}

const longTime = () => {
  return Promise.resolve()
}

module.exports = ContentEngine