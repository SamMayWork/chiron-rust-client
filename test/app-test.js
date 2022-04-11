/* eslint-disable no-undef */

const supertest = require('supertest')
const nock = require('nock')
const { expect } = require('chai')
const sinon = require('sinon')
const fetch = require('node-fetch')
const fs = require('fs')

const { ContentEngine } = require('../src/contentEngine')

describe('App Tests', () => {
  let simpleTutorial, app, fsWriteFileStub

  beforeEach(() => {
    simpleTutorial = require('./samples/simple.json')

    // Need to ensure we're getting a fresh server for each test
    delete require.cache[`${process.cwd()}/src/app.js`]
    app = require('../src/app')
    fsWriteFileStub = sinon.stub(fs, 'writeFileSync')
  })

  afterEach(() => {
    fsWriteFileStub.restore()
    nock.cleanAll()
  })

  it('Should start the application on the port and serve some content', () => {
    return supertest(app)
      .get('/')
      .expect(200)
      .then(response => {
        expect(response).to.not.equal(undefined)
      })
  })

  context('/htmlcontent', () => {
    it('Should return 404 when called on the /htmlcontent path with nothing loaded', () => {
      return supertest(app)
        .get('/htmlcontent')
        .then(response => {
          expect(response.status).to.equal(404)
        })
    })

    it('Should return 200 with some content when called on /htmlcontent with content loaded', () => {
      const getHtmlContentStub = sinon.stub(ContentEngine.prototype, 'getHtmlContent').returns('Hello, World!')
      return supertest(app)
        .get('/htmlcontent')
        .then(response => {
          expect(response.status).to.equal(200)
          expect(response.text).to.equal('Hello, World!')
          getHtmlContentStub.restore()
        })
    })
  })

  context('/content', () => {
    it('Should return the response 200 when loaded with content that exists', () => {
      nock('http://mockhost.com')
        .get('/content.json')
        .reply(200, JSON.parse(JSON.stringify(simpleTutorial)))

      return supertest(app)
        .post('/content')
        .send({ contentUrl: 'mockhost.com/content.json' })
        .then(response => {
          expect(response.status).to.equal(200)
        })
    })

    it('Should return the response 400 if no content url has been sent', () => {
      nock('http://mockhost.com')
        .get('/content.json')
        .reply(200)

      return supertest(app)
        .post('/content')
        .send({})
        .then(response => {
          expect(response.status).to.equal(400)
        })
    })

    it('Should return the response 404 when loaded with content that does not exist', () => {
      nock('http://mockhost.com')
        .get('/content.json')
        .reply(404)

      return supertest(app)
        .post('/content')
        .send({ contentUrl: 'mockhost.com/content.json' })
        .then(response => {
          expect(response.status).to.equal(404)
        })
    })

    it('Should return 500 and the error if there is an error during the loading of the content', () => {
      const fetchStub = sinon.stub(fetch, 'Promise').rejects('Bang!')
      return supertest(app)
        .post('/content')
        .send({ contentUrl: 'mockhost.com/content.json' })
        .then(response => {
          expect(response.status).to.equal(500)
          expect(JSON.parse(response.text)).to.not.equal(undefined)
          fetchStub.restore()
        })
    })
  })

  context('/health', () => {
    it('Should return 200 when the server is active', () => {
      return supertest(app)
        .get('/health')
        .then(response => {
          expect(response.status).to.equal(200)
        })
    })
  })

  context('/command', () => {
    let checkChunkConditionsStub

    beforeEach(() => {
      checkChunkConditionsStub = sinon.stub(ContentEngine.prototype, 'checkChunkConditions')
    })

    afterEach(() => {
      checkChunkConditionsStub.restore()
    })

    it('Should return 500 to the caller if something fails', () => {
      checkChunkConditionsStub.restore()
      checkChunkConditionsStub = sinon.stub(ContentEngine.prototype, 'checkChunkConditions').rejects('Bang!')
      return supertest(app)
        .post('/command')
        .send({ command: 'ls -al' })
        .then(response => {
          expect(response.status).to.equal(500)
          checkChunkConditionsStub.restore()
        })
    })
  })

  context('/history', () => {
    it('Should return status 204 if there is no content loaded', () => {
      return supertest(app)
        .get('/history')
        .then(response => {
          expect(response.status).to.equal(204)
        })
    })

    it('Should return status 200 with an empty history if there is content loaded but nothing has happened', () => {
      nock('http://mockhost.com')
        .get('/content.json')
        .reply(200, JSON.parse(JSON.stringify(simpleTutorial)))

      return supertest(app)
        .post('/content')
        .send({ contentUrl: 'mockhost.com/content.json' })
        .then(response => {
          return supertest(app)
            .get('/history')
            .then(response => {
              expect(response.status).to.equal(200)
              expect(response.text).to.not.equal(undefined)
              const responseObj = JSON.parse(response.text)
              expect(responseObj.length).to.equal(1)
              expect(responseObj[0].commandAttempts).to.deep.equal([])
            })
        })
    })

    it('Should return status 200 with history if there is content loaded and something has happened', () => {
      nock('http://mockhost.com')
        .get('/content.json')
        .reply(200, JSON.parse(JSON.stringify(simpleTutorial)))

      return supertest(app)
        .post('/content')
        .send({ contentUrl: 'mockhost.com/content.json' })
        .then(response => {
          return supertest(app)
            .post('/command')
            .send({ command: 'ls' })
            .then(commandResponse => {
              return supertest(app)
                .get('/history')
                .then(historyResponse => {
                  expect(historyResponse.status).to.equal(200)
                  const responseObj = JSON.parse(historyResponse.text)
                  expect(responseObj.length).to.equal(1)
                  expect(responseObj[0].commandAttempts).to.deep.equal(['ls'])
                })
            })
        })
    })
  })

  context('/restart', () => {
    let initiateRestartStub, processExitStub

    beforeEach(() => {
      initiateRestartStub = sinon.stub(ContentEngine.prototype, 'initiateRestart').resolves()
      processExitStub = sinon.stub(process, 'exit')
    })

    afterEach(() => {
      initiateRestartStub.restore()
      processExitStub.restore()
    })

    it('Should accept PUT requests on /restart and then initiate a restart when not a hard restart', () => {
      return supertest(app)
        .put('/restart')
        .then(response => {
          expect(response.status).to.equal(204)
        })
    })

    it('Should perform a cluster restart and then restart the process when doing a hard restart', () => {
      return supertest(app)
        .put('/restart')
        .send({ hardRestart: true })
        .then(response => {
          expect(response.status).to.equal(204)
          expect(processExitStub.callCount).to.equal(1)
          expect(initiateRestartStub.callCount).to.equal(1)
        })
    })
  })
})
