// const KubeProcessor = require('./kubeProcessor')

class ContentEngine {
  states = {
    PROCESSING: 'processing',
    DONE: 'done'
  }

  constructor (content) {
    this.content = content
    // this.kubeProcessor = new KubeProcessor()

    this.processNext()
  }

  /**
   * Processes next commands in the content array
   */
  processNext() {
    this.state = this.states.PROCESSING
    const self = this

    const currentContent = this.content[0]

    this.currentHtmlContent = currentContent.content.value

    const commandPromises = []
    currentContent.commands.commands.forEach(command => {
      commandPromises.push(longTime())
    })

    Promise.all(commandPromises)
      .then(() => {
        self.state = self.states.DONE
      })
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