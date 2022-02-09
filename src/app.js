const express = require('express')
const fetch = require('node-fetch')
const cors = require('cors')

const Logger = require('./logger')
const logging = new Logger('chiron-client')
const ilProcessor = require('./processor')
const ContentEngine = require('./contentEngine')
const { runCommand } = require('./kubeProcessor')

let contentEngine

const app = express()

app.use(cors())
app.use(express.static('./static/'))
app.use(express.json())

app.get('/', (req, res) => {
  res.send('OK')
})

app.post('/content', async (req, res) => {
  logging.info('Got POST for content, trying to load it')

  const contentUrl = req.body.contentUrl

  if (!contentUrl) {
    logging.error('No content URL has been provided')
    res.sendStatus(400)
    return
  }

  try {
    const ilContent = await fetch(contentUrl)
    const ilResponse = await ilContent.json()

    logging.info(`Found content, processing through IL`)
    res.sendStatus(200)

    const processedCommands = ilProcessor.processIntermediateLanguage(ilResponse)

    contentEngine = new ContentEngine(processedCommands)
  } catch (e) {
    logging.error(`ERROR: ${e.message}`)
    res.sendStatus(500)
  }
})

app.get('/htmlcontent', (req, res) => {
  const content = contentEngine?.getHtmlContent()
  
  content ? res.send(content) : res.sendStatus(404)
})

app.post('/command', async (req, res) => {
  logging.info(`Running command ${req.body.command}`)

  try {
    const { stdout } = await runCommand(req.body.command)
    res.send(stdout)
  } catch (error) {
    logging.error(error)
    res.sendStatus(500)
  }
})

module.exports = app