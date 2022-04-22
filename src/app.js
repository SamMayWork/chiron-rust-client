const express = require('express')
const fetch = require('node-fetch')
const cors = require('cors')

const Logger = require('./logger')
const logging = new Logger('chiron-client')
const { ContentEngine } = require('./contentEngine')

let contentEngine = new ContentEngine()

const app = express()

app.use(cors())
app.use(express.static('./static/'))
app.use(express.json())

app.get('/health', (req, res) => {
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
    const ilContent = await fetch(`http://${contentUrl}`)

    if (ilContent.status === 404) {
      logging.error('Could not find content')
      res.sendStatus(404)
      return
    }

    const ilResponse = await ilContent.json()

    logging.info('Found content, processing through IL')

    res.sendStatus(200)

    contentEngine = new ContentEngine()
    await contentEngine.init(ilResponse)
  } catch (e) {
    logging.error(`ERROR: ${e}`)
    res.status(500).json(e)
  }
})

app.get('/htmlcontent', (req, res) => {
  const content = contentEngine?.getHtmlContent()

  content ? res.send(content) : res.sendStatus(404)
})

app.post('/command', async (req, res) => {
  const command = req.body.command
  logging.info(`Running command ${command}`)

  try {
    const result = await contentEngine.executeCommand(command)

    if (result) {
      res.json(result)
      return
    }

    res.status(204).send()
  } catch (error) {
    logging.error(error)
    res.status(500).send()
  }
})

app.get('/history', async (req, res) => {
  logging.info('Getting the current command history')

  const chunks = contentEngine.completedChunks

  chunks !== undefined
    ? res.json(contentEngine.completedChunks)
    : res.sendStatus(204)
})

app.put('/restart', async (req, res) => {
  logging.info(`Restart Information was ${req.body}`)
  await contentEngine.initiateRestart()

  if (req.body.hardRestart) {
    process.exit(0)
  }

  res.sendStatus(204)
})

module.exports = app
