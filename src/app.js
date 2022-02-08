const express = require('express')
const fetch = require('node-fetch')
const cors = require('cors')

const ilProcessor = require('./processor')
const ContentEngine = require('./contentEngine')

let contentEngine

const app = express()

app.use(cors())
app.use(express.static('./static/'))
app.use(express.json())

app.get('/', (req, res) => {
  res.send('OK')
})

app.post('/content', async (req, res) => {
  console.log('Handling Request for content')

  const contentUrl = req.body.contentUrl

  if (!contentUrl) {
    console.log('No content URL has been provided')
    res.sendStatus(400)
    return
  }

  try {
    const ilContent = await fetch(contentUrl)
    const ilResponse = await ilContent.json()

    console.log(`Found content ${JSON.stringify(ilResponse)}`)
    res.sendStatus(200)

    const processedCommands = ilProcessor.processIntermediateLanguage(ilResponse)

    contentEngine = new ContentEngine(processedCommands)
  } catch (e) {
    console.log(`ERROR: ${e.message}`)
    res.sendStatus(500)
  }
})

app.get('/htmlcontent', (req, res) => {
  const content = contentEngine?.getHtmlContent()
  
  content ? res.send(content) : res.sendStatus(404)
})

module.exports = app