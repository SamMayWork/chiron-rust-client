const express = require('express')
const fetch = require('node-fetch')
const cors = require('cors')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

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
    contentEngine = new ContentEngine()
    await contentEngine.init(ilResponse)

    res.sendStatus(200)
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
  logging.info(`Running command ${req.body.command}`)

  try {
    // We might ve waiting for a specific command to be run before progressing the content
    // so we need to check the current chunm conditions
    const newContent = await contentEngine.checkChunkConditions(req.body.command)

    /* istanbul ignore next */
    logging.debug(newContent ? 'Call me back for new content' : 'There is no new content')

    // Due to the way we have to import ChildProcess and then Promisify it
    // (because it's still working with CallBacks *sigh*) we check if we're
    // being run as part of the test harness and then skip if we are, this is
    // a hack but it's 2022 and child_process is still using CallBacks.
    /* istanbul ignore next */
    if (process.env.npm_command !== 'test') {
      try {
        const { stdout } = await exec(req.body.command)
        res.json({
          newContent,
          commandOutput: stdout
        })
      } catch (error) {
        res.json({
          newContent,
          commandOutput: error.stderr
        })
      }
    } else {
      logging.error('RUNNING IN TEST MODE, THIS SHOULD BE IN PROD')
      logging.error('RUNNING IN TEST MODE, THIS SHOULD BE IN PROD')
      logging.error('RUNNING IN TEST MODE, THIS SHOULD BE IN PROD')
      logging.error('RUNNING IN TEST MODE, THIS SHOULD BE IN PROD')
      res.sendStatus(204)
    }
  } catch (error) {
    logging.error(error)
    res.sendStatus(500)
  }
})

app.get('/history', async (req, res) => {
  logging.info('Getting the current command history')

  const chunks = contentEngine.completedChunks

  chunks !== undefined
    ? res.json(contentEngine.completedChunks)
    : res.sendStatus(204)
})

module.exports = app
