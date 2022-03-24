const express = require('express')
const fetch = require('node-fetch')
const cors = require('cors')

const Logger = require('./logger')
const logging = new Logger('chiron-client')
const ContentEngine = require('./contentEngine')
const { runCommand } = require('./kubeChecker')

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
    const ilContent = await fetch(`http://${contentUrl}`)

    // TODO: Schema Validation

    const ilResponse = await ilContent.json()

    logging.info('Found content, processing through IL')
    contentEngine = new ContentEngine(ilResponse)

    res.sendStatus(200)
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
    // We might ve waiting for a specific command to be run before progressing the content
    // so we need to check the current chunm conditions
    const newContent = contentEngine.checkChunkConditions(req.body.command)

    logging.debug(newContent ? 'Call me back for new content' : 'There is no new content')
    const { stdout, stderr } = await runCommand(req.body.command)
    logging.info(stdout)
    logging.info(stderr)
    res.json({
      newContent,
      commandOutput: stdout || stderr
    })
  } catch (error) {
    logging.error(error)
    res.sendStatus(500)
  }
})

module.exports = app
