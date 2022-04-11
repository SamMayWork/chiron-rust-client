/* eslint-disable no-undef */

const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('fs')

const { ContentEngine, ENGINE_STATES } = require('../src/contentEngine')
const Logger = require('../src/logger')

describe('Content Engine Tests', () => {
  let simpleTutorial, complexTutorial, deploymentsTutorial, fsWriteFileStub, meetsResourceRequirementsStub, imageTutorial

  beforeEach(() => {
    simpleTutorial = require('./samples/simple.json')
    complexTutorial = require('./samples/complex.json')
    deploymentsTutorial = require('./samples/deployments-tutorial.json')
    imageTutorial = require('./samples/image.json')
    fsWriteFileStub = sinon.stub(fs, 'writeFileSync')
    meetsResourceRequirementsStub = sinon.stub(ContentEngine.prototype, 'meetsResourceRequirements')
  })

  afterEach(() => {
    fsWriteFileStub.restore()
    meetsResourceRequirementsStub.restore()
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
            value: 'ls *'
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

    it('Should correctly write chunks with assets to disk', async () => {
      const engine = new ContentEngine()
      engine.document = JSON.parse(JSON.stringify(imageTutorial))
      await engine.processNextChunk()
      expect(fsWriteFileStub.callCount).to.equal(1)
      expect(engine.state).to.equal(ENGINE_STATES.DONE)
      expect(engine.currentChunk).to.not.equal(undefined)
      expect(engine.currentChunk).to.deep.equal({
        preCommands: [
        ],
        text: '<p>Hello, World!</p>\n<p><img src="testimage.png" alt="World&#39;s most interesting image"></p>\n',
        postChecks: [
          {
            method: 'COMMANDWAIT',
            type: 'POSTCHECK',
            value: 'ls -al'
          }
        ],
        assets: [
          {
            name: 'testimage.png',
            image: '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'
          }
        ]
      })
    })
  })

  describe('checkChunkConditions', () => {
    let processNextChunkStub, engine, getByResourceTypeStub

    beforeEach(async () => {
      meetsResourceRequirementsStub.restore()
      engine = new ContentEngine()
      await engine.init(JSON.parse(JSON.stringify(simpleTutorial)))
      processNextChunkStub = sinon.stub(ContentEngine.prototype, 'processNextChunk')
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType')
    })

    afterEach(() => {
      processNextChunkStub.restore()
      getByResourceTypeStub.restore()
    })

    context('History Functions', () => {
      beforeEach(async () => {
        processNextChunkStub.restore()
        engine = new ContentEngine()
        getByResourceTypeStub.restore()
        getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
          'basic-deployment-a',
          'basic-deployment-b',
          'basic-deployment-c'
        ])
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

      it('Should stop storing commands when the final chunk has been reached', async () => {
        await engine.checkChunkConditions('kubectl get deployments')
        await engine.checkChunkConditions('kubectl get pods')
        await engine.checkChunkConditions('ls -al')
        expect(engine.completedChunks[0].commandAttempts).to.deep.equal(['kubectl get pods'])
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

    it('Should continue to the next check when the CHECK EQUALS command is satisfied', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
        'basic-deployment-a',
        'basic-deployment-b',
        'basic-deployment-c'
      ])
      engine.currentChunk.postChecks = [
        {
          method: 'CHECK',
          type: 'POSTCHECK',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'EQUALS',
          value: 3
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(true)
    })

    it('Should not continue to the next check when the CHECK EQUALS command is satisfied, but there is another postCheck to fulfill', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
        'basic-deployment-a',
        'basic-deployment-b',
        'basic-deployment-c'
      ])
      engine.currentChunk.postChecks = [
        {
          method: 'COMMANDWAIT',
          type: 'POSTCHECK',
          value: 'kubectl get deployments'
        },
        {
          method: 'CHECK',
          type: 'POSTCHECK',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'EQUALS',
          value: 4
        }
      ]
      expect(await engine.checkChunkConditions('kubectl get deployments')).to.equal(false)
    })

    it('Should continue to the next check when the CHECK EQUALS command is satisfied and no name is provided', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
        'basic-deployment-a',
        'basic-deployment-b',
        'basic-deployment-c',
        'basic-deployment-d'
      ])
      engine.currentChunk.postChecks = [
        {
          method: 'CHECK',
          type: 'POSTCHECK',
          kind: 'POD',
          equalityOperator: 'EQUALS',
          value: 4
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(true)
    })

    it('Should continue to the next check when the CHECK GREATERTHAN command is satisfied', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
        'basic-deployment-a',
        'basic-deployment-b',
        'basic-deployment-c',
        'basic-deployment-d'
      ])
      engine.currentChunk.postChecks = [
        {
          method: 'CHECK',
          type: 'POSTCHECK',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'GREATERTHAN',
          value: 1
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(true)
    })

    it('Should continue to the next check when the CHECK LESSTHAN command is satisfied', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
        'basic-deployment-a',
        'basic-deployment-b',
        'basic-deployment-c',
        'basic-deployment-d'
      ])
      engine.currentChunk.postChecks = [
        {
          method: 'CHECK',
          type: 'POSTCHECK',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'LESSTHAN',
          value: 5
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(true)
    })

    it('Should not continue to the next check when the CHECK EQUALS command is not satisfied', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
        'basic-deployment-a',
        'basic-deployment-b',
        'basic-deployment-c'
      ])
      engine.currentChunk.postChecks = [
        {
          method: 'CHECK',
          type: 'POSTCHECK',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'EQUALS',
          value: 4
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(false)
    })

    it('Should not continue to the next check when the CHECK GREATERTHAN command is not satisfied', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
        'basic-deployment-a',
        'basic-deployment-b',
        'basic-deployment-c'
      ])
      engine.currentChunk.postChecks = [
        {
          method: 'CHECK',
          type: 'POSTCHECK',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'GREATERTHAN',
          value: 10
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(false)
    })

    it('Should not continue to the next check when the CHECK LESSTHAN command is not satisfied', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
        'basic-deployment-a',
        'basic-deployment-b',
        'basic-deployment-c'
      ])
      engine.currentChunk.postChecks = [
        {
          method: 'CHECK',
          type: 'POSTCHECK',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'LESSTHAN',
          value: 1
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(false)
    })

    it('Should always return false and print an error when the equality operator does not match', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
        'basic-deployment-a',
        'basic-deployment-b',
        'basic-deployment-c'
      ])
      const loggingSpy = sinon.spy(Logger.prototype, 'error')
      engine.currentChunk.postChecks = [
        {
          method: 'CHECK',
          type: 'POSTCHECK',
          kind: 'POD',
          target: 'basic-deployment',
          equalityOperator: 'SOMETHING',
          value: 3
        }
      ]
      expect(await engine.checkChunkConditions()).to.equal(false)
      expect(loggingSpy.callCount).to.equal(1)
    })
  })

  describe('meetsResourceRequirements', () => {
    let engine, getByResourceTypeStub, processNextChunkStub

    beforeEach(async () => {
      meetsResourceRequirementsStub.restore()
      engine = new ContentEngine()
      processNextChunkStub = sinon.stub(ContentEngine.prototype, 'processNextChunk')
      await engine.init(JSON.parse(JSON.stringify(complexTutorial)))
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([
        'something-a'
      ])
    })

    afterEach(() => {
      getByResourceTypeStub.restore()
      processNextChunkStub.restore()
    })

    it('Should not resolve the promise when blocking mode is turned on and the checks fail', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType')
      getByResourceTypeStub.onCall(0).resolves(['something'])
      getByResourceTypeStub.onCall(1).resolves(['basic-deployment-a', 'basic-deployment-b', 'basic-deployment-c'])
      const result = await engine.meetsResourceRequirements('POD', 'default', 3, 'EQUALS', 'basic-deployment', true)
      expect(result).to.equal(true)
      expect(getByResourceTypeStub.callCount).to.equal(2)
    })

    it('Should resolve true when there are no resources and the check was for no resources', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([])
      const result = await engine.meetsResourceRequirements('POD', 'default', 0, 'EQUALS')
      expect(result).to.equal(true)
      expect(getByResourceTypeStub.callCount).to.equal(1)
    })

    it('Should resolve false when there are no resources and the check is for some resources', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves([])
      const result = await engine.meetsResourceRequirements('POD', 'default', 3, 'EQUALS')
      expect(result).to.equal(false)
      expect(getByResourceTypeStub.callCount).to.equal(1)
    })

    it('Should resolve true when using partial matching and there are resources', async () => {
      getByResourceTypeStub.restore()
      getByResourceTypeStub = sinon.stub(engine.kubeChecker, 'getByResourceType').resolves(['basic-deployment-a', 'basic-deployment-b', 'something-else-a'])
      const result = await engine.meetsResourceRequirements('POD', 'default', 2, 'EQUALS', 'basic-*')
      expect(result).to.equal(true)
      expect(getByResourceTypeStub.callCount).to.equal(1)
    })
  })

  describe('initiateRestart', () => {
    it('Should configure the state of the content engine to NOCONTENT and call KubeChecker to start the restart', async () => {
      const engine = new ContentEngine()
      await engine.init(JSON.parse(JSON.stringify(simpleTutorial)))
      const restartStub = sinon.stub(engine.kubeChecker, 'cleanAll')
      await engine.initiateRestart()
      expect(engine.state).to.equal(ENGINE_STATES.NOCONTENT)
      expect(restartStub.callCount).to.equal(1)
      restartStub.restore()
    })
  })
})
