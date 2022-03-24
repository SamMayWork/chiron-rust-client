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
      // commandPromises.push(longTime())
    })

    Promise.all(commandPromises)
      .then(() => {
        self.state = self.states.DONE
        self.content.shift()
      })
  }

  /**
   * Checks to see if the post conditions of the chunk have been met
   */
  checkChunkConditions (command) {
    if (this.content[0].postChecks[0].target === command) {
      this.processNextChunk()
      return true
    }

    return false
  }

  /**
   * Gets the current HTML content to show on the client
   */
  getHtmlContent () {
    return this.state === this.states.DONE ? this.currentHtmlContent : undefined
  }
}

module.exports = ContentEngine