/* eslint-disable no-undef */

const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('fs')

const { ContentEngine, ENGINE_STATES } = require('../src/contentEngine')
const { KubeChecker } = require('../src/kubeChecker')
const Logger = require('../src/logger')

describe('Content Engine Tests', () => {
  let simpleTutorial, complexTutorial, deploymentsTutorial, fsWriteFileStub

  beforeEach(() => {
    simpleTutorial = require('./samples/simple.json')
    complexTutorial = require('./samples/complex.json')
    deploymentsTutorial = require('./samples/deployments-tutorial.json')
    fsWriteFileStub = sinon.stub(fs, 'writeFileSync')
  })

  afterEach(() => {
    fsWriteFileStub.restore()
  })

  describe('init', () => {
    it('Should call through to processNextChunk and set the document on the object', () => {
      const processNextChunkStub = sinon.stub(ContentEngine.prototype, 'processNextChunk')
      const engine = new ContentEngine()
      engine.init('some document text')
      expect(processNextChunkStub.callCount).to.equal(1)
      expect(engine.document).to.not.equal(undefined)
      processNextChunkStub.restore()
    })
  })

  describe('getHtmlContent', () => {
    it('Should return the current text when the state is DONE', () => {
      const engine = new ContentEngine()
      engine.state = ENGINE_STATES.DONE
      engine.currentChunk = {
        text: 'Hello, World!'
      }
      expect(engine.getHtmlContent()).to.equal('Hello, World!')
    })

    it('Should return undefined when the state is not done and there is no content', () => {
      const engine = new ContentEngine()
      engine.state = ENGINE_STATES.PROCESSING
      expect(engine.getHtmlContent()).to.equal(undefined)
      engine.state = ENGINE_STATES.NOCONTENT
      expect(engine.getHtmlContent()).to.equal(undefined)
    })
  })

  describe('processNextChunk', () => {
    beforeEach(() => {
      fsWriteFileStub.restore()
      fsWriteFileStub = sinon.stub(fs, 'writeFileSync').callsFake((path, content) => {
        if (!path || !content || typeof content !== 'string') {
          throw new Error('Bang!')
        }
      })
    })

    it('Should correctly load simple JSON content and process the content', async () => {
      const engine = new ContentEngine()
      engine.document = JSON.parse(JSON.stringify(simpleTutorial))
      await engine.processNextChunk()
      expect(fsWriteFileStub.callCount).to.equal(1)
      expect(engine.state).to.equal(ENGINE_STATES.DONE)
      expect(engine.currentChunk).to.not.equal(undefined)
      expect(engine.currentChunk).to.deep.equal({
        preCommands: [
          {
            type: 'PRECOMMAND',
            method: 'APPLY',
            content: {
              name: 'content.yaml',
              value: 'hello:\n  world: 1'
            }
          }
        ],
        text: '<h1 id="hello">Hello</h1>\n<p>Welcome to my awesome Tutorial!</p>\n',
        postChecks: [
          {
            type: 'POSTCHECK',
            method: 'COMMANDWAIT',
            value: 'ls -al'
          },
          {
            type: 'POSTCHECK',
            method: 'COMMANDWAIT',
            value: 'ls -al'
          }
        ]
      })
    })

    it('Should correctly load complex JSON content and process the content', async () => {
      const engine = new ContentEngine()
      engine.document = complexTutorial
      await engine.processNextChunk()
      expect(fsWriteFileStub.callCount).to.equal(2)
      expect(engine.state).to.equal(ENGINE_STATES.DONE)
      expect(engine.currentChunk).to.not.equal(undefined)
      expect(engine.currentChunk).to.deep.equal({
        preCommands: [
          {
            type: 'PRECOMMAND',
            method: 'APPLY',
            content: {
              name: 'content.yaml',
              value: 'hello:\n  world: 1'
            }
          },
          {
            type: 'PRECOMMAND',
            method: 'APPLY',
            content: {
              name: 'deployment.yaml',
              value: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: basic-deployment\n  namespace: default\n  labels:\n    app: basic-deployment\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: basic-deployment\n  template:\n    metadata:\n      labels:\n        app: basic-deployment\n    spec:\n      containers:\n      - name: basic-deployment\n        image: ssmay0/simple-container\n        ports:\n        - containerPort: 8080'
            }
          },
          {
            method: 'WAIT',
            type: 'PRECOMMAND',
            kind: 'POD',
            target: 'basic-deployment',
            equalityOperator: 'EQUALS',
            value: 3
          }
        ],
        text: '<h1 id="hello">Hello</h1>\n<p>Welcome to my awesome Tutorial!</p>\n',
        postChecks: [
          {
            type: 'POSTCHECK',
            method: 'COMMANDWAIT',
            value: 'kubectl get deployments'
          }
        ]
      })
    })

    it('Should correctly load the final page when the content is finished', async () => {
      const engine = new ContentEngine()
      engine.document = JSON.parse(JSON.stringify(simpleTutorial))
      await engine.processNextChunk()
      await engine.processNextChunk()
      expect(engine.currentChunk).to.not.equal(undefined)
      expect(engine.currentChunk).to.deep.equal({
        finalChunk: true,
        text: "<h1>End</h1><p>You've reached the end of this document and have covered all of the content, well done!</p>\n"
      })
    })
  })

  describe('checkChunkConditions', () => {
    let processNextChunkStub, engine

    beforeEach(async () => {
      engine = new ContentEngine()
      await engine.init(JSON.parse(JSON.stringify(simpleTutorial)))
      processNextChunkStub = sinon.stub(ContentEngine.prototype, 'processNextChunk')
    })

    afterEach(() => {
      processNextChunkStub.restore()
    })

    context('History Functions', () => {
      beforeEach(async () => {
        processNextChunkStub.restore()
        engine = new ContentEngine()
        await engine.init(JSON.parse(JSON.stringify(deploymentsTutorial)))
      })

      it('Should store the information for the current chunk when no commands have been attempted', () => {
        expect(engine.completedChunks).to.not.equal(undefined)
        expect(engine.completedChunks.length).to.equal(1)
        expect(engine.completedChunks[0].startTime).to.not.equal(undefined)
        expect(engine.completedChunks[0].commandAttempts).to.deep.equal([])
      })

      it('Should store commands when the command is incorrect', async () => {
        await engine.checkChunkConditions('helloworld')
        expect(engine.completedChunks).to.not.equal(undefined)
        expect(engine.completedChunks.length).to.equal(1)
        expect(engine.completedChunks[0].startTime).to.not.equal(undefined)
        expect(engine.completedChunks[0].commandAttempts).to.deep.equal(['helloworld'])
      })

      it('Should store all commands when the command is incorrect', async () => {
        await engine.checkChunkConditions('helloworld')
        await engine.checkChunkConditions('helloworld1')
        await engine.checkChunkConditions('helloworld2')
        await engine.checkChunkConditions('helloworld3')
        await engine.checkChunkConditions('helloworld4')
        expect(engine.completedChunks).to.not.equal(undefined)
        expect(engine.completedChunks.length).to.equal(1)
        expect(engine.completedChunks[0].startTime).to.not.equal(undefined)
        expect(engine.completedChunks[0].commandAttempts.length).to.equal(5)
      })

      it('Should store commands when the command is incorrect and then process to the next chunk', async () => {
        await engine.checkChunkConditions('helloworld')
        expect(engine.completedChunks).to.not.equal(undefined)
        expect(engine.completedChunks.length).to.equal(1)
        expect(engine.completedChunks[0].startTime).to.not.equal(undefined)
        expect(engine.completedChunks[0].commandAttempts).to.deep.equal(['helloworld'])
        await engine.checkChunkConditions('kubectl get deployments')
        expect(engine.completedChunks.length).to.equal(2)
        expect(engine.completedChunks[1].startTime).to.not.equal(undefined)
        expect(engine.completedChunks[1].endTime).to.not.equal(undefined)
        expect(engine.completedChunks[1].commandAttempts).to.deep.equal(['helloworld', 'kubectl get deployments'])
        expect(engine.completedChunks[0].startTime).to.not.equal(undefined)
        expect(engine.completedChunks[0].endTime).to.equal(undefined)
      })
    })

    it('Should return undefined if there is no content or if there is no current chunk', async () => {
      engine.state = ENGINE_STATES.NOCONTENT
      engine.currentChunk = 'something'
      expect(await engine.checkChunkConditions()).to.equal(undefined)
    })

    it('Should return undefined if there is no content or if there is no current chunk', async () => {
      engine.state = ENGINE_STATES.DONE
      engine.currentChunk = undefined
      expect(await engine.checkChunkConditions()).to.equal(undefined)
    })

    it('Should call through all of the PostChecks when the checks are COMMANDWAIT', async () => {
      let newContent = await engine.checkChunkConditions('ls -al')
      expect(newContent).to.equal(false)
      expect(processNextChunkStub.callCount).to.equal(0)
      newContent = await engine.checkChunkConditions('ls -al')
      expect(newContent).to.equal(true)
      expect(processNextChunkStub.callCount).to.equal(1)
    })

    it('Should check the commands but not progress when the command entered is wrong', async () => {
      let newContent = await engine.checkChunkConditions('ls')
      expect(newContent).to.equal(false)
      expect(processNextChunkStub.callCount).to.equal(0)
      newContent = await engine.checkChunkConditions('ls')
      expect(newContent).to.equal(false)
      expect(processNextChunkStub.callCount).to.equal(0)
    })

    it('Should return false if the PostCheck is not supported', async () => {
      engine.currentChunk.postChecks.unshift({
        key: 'SOMETHING'
      })
      expect(await engine.checkChunkConditions()).to.equal(false)
    })

    it('Should continue to the next check when the WAIT EQUALS command is satisfied', async () => {
      const getByResourceTypeStub = sinon.stub(KubeChecker.prototype, 'getByResourceType').resolves({
        body: [
          'basic-deployment-1',
          'basic-deployment-2',
          'basic-deployment-3'
        ]
      })
      engine.currentChunk.postChecks = [
        {
          method: 'WAIT',
          type: 'PRECOMMAND',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'EQUALS',
          value: 3
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(true)
      getByResourceTypeStub.restore()
    })

    it('Should continue to the next check when the WAIT EQUALS command is satisfied', async () => {
      const getByResourceTypeStub = sinon.stub(KubeChecker.prototype, 'getByResourceType').resolves({
        body: [
          'basic-deployment-1',
          'basic-deployment-2',
          'basic-deployment-3'
        ]
      })
      engine.currentChunk.postChecks = [
        {
          method: 'WAIT',
          type: 'PRECOMMAND',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'EQUALS',
          value: 3
        },
        {
          method: 'COMMANDWAIT',
          type: 'POSTCHECK',
          value: 'kubectl get deployments'
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(false)
      getByResourceTypeStub.restore()
    })

    it('Should continue to the next check when the WAIT EQUALS command is satisfied and no name is provided', async () => {
      const getByResourceTypeStub = sinon.stub(KubeChecker.prototype, 'getByResourceType').resolves({
        body: [
          'basic-deployment-1',
          'basic-deployment-2',
          'basic-deployment-3',
          'something-else-a'
        ]
      })
      engine.currentChunk.postChecks = [
        {
          method: 'WAIT',
          type: 'PRECOMMAND',
          kind: 'POD',
          equalityOperator: 'EQUALS',
          value: 4
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(true)
      getByResourceTypeStub.restore()
    })

    it('Should continue to the next check when the WAIT GREATERTHAN command is satisfied', async () => {
      const getByResourceTypeStub = sinon.stub(KubeChecker.prototype, 'getByResourceType').resolves({
        body: [
          'basic-deployment-1',
          'basic-deployment-2',
          'basic-deployment-3'
        ]
      })
      engine.currentChunk.postChecks = [
        {
          method: 'WAIT',
          type: 'PRECOMMAND',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'GREATERTHAN',
          value: 1
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(true)
      getByResourceTypeStub.restore()
    })

    it('Should continue to the next check when the WAIT LESSTHAN command is satisfied', async () => {
      const getByResourceTypeStub = sinon.stub(KubeChecker.prototype, 'getByResourceType').resolves({
        body: [
          'basic-deployment-1',
          'basic-deployment-2',
          'basic-deployment-3'
        ]
      })
      engine.currentChunk.postChecks = [
        {
          method: 'WAIT',
          type: 'PRECOMMAND',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'LESSTHAN',
          value: 5
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(true)
      getByResourceTypeStub.restore()
    })

    it('Should not continue to the next check when the WAIT EQUALS command is not satisfied', async () => {
      const getByResourceTypeStub = sinon.stub(KubeChecker.prototype, 'getByResourceType').resolves({
        body: [
          'basic-deployment-1',
          'basic-deployment-2',
          'basic-deployment-3'
        ]
      })
      engine.currentChunk.postChecks = [
        {
          method: 'WAIT',
          type: 'PRECOMMAND',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'EQUALS',
          value: 4
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(false)
      getByResourceTypeStub.restore()
    })

    it('Should not continue to the next check when the WAIT GREATERTHAN command is not satisfied', async () => {
      const getByResourceTypeStub = sinon.stub(KubeChecker.prototype, 'getByResourceType').resolves({
        body: [
          'basic-deployment-1',
          'basic-deployment-2',
          'basic-deployment-3'
        ]
      })
      engine.currentChunk.postChecks = [
        {
          method: 'WAIT',
          type: 'PRECOMMAND',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'GREATERTHAN',
          value: 10
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(false)
      getByResourceTypeStub.restore()
    })

    it('Should not continue to the next check when the WAIT LESSTHAN command is not satisfied', async () => {
      const getByResourceTypeStub = sinon.stub(KubeChecker.prototype, 'getByResourceType').resolves({
        body: [
          'basic-deployment-1',
          'basic-deployment-2',
          'basic-deployment-3'
        ]
      })
      engine.currentChunk.postChecks = [
        {
          method: 'WAIT',
          type: 'PRECOMMAND',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'LESSTHAN',
          value: 1
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(false)
      getByResourceTypeStub.restore()
    })

    it('Should always return false and print an error when the equality operator does not match', async () => {
      const loggingSpy = sinon.spy(Logger.prototype, 'error')
      const getByResourceTypeStub = sinon.stub(KubeChecker.prototype, 'getByResourceType').resolves({
        body: [
          'basic-deployment-1',
          'basic-deployment-2',
          'basic-deployment-3'
        ]
      })
      engine.currentChunk.postChecks = [
        {
          method: 'WAIT',
          type: 'PRECOMMAND',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'SOMETHING',
          value: 3
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(false)
      expect(loggingSpy.callCount).to.equal(1)
      getByResourceTypeStub.restore()
    })
  })
})
