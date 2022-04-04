/* eslint-disable no-undef */

const { expect } = require('chai')
const sinon = require('sinon')
const { KubeChecker } = require('../src/kubeChecker')

describe('KubeChecker Tests', () => {
  let checker
  let listNamespacedPodStub, listNamespacedDeploymentStub, listNamespacedConfigMapStub, listNamespacedSecretStub, listNamespacedReplicaSetStub, listNamespacedServiceStub
  let podResponse, deploymentResponse, replicaSetResponse, configMapResponse, secretResponse, serviceResponse

  beforeEach(() => {
    checker = new KubeChecker()

    podResponse = require('./testResponses/pod.json')
    deploymentResponse = require('./testResponses/deployment.json')
    replicaSetResponse = require('./testResponses/replicaSet.json')
    configMapResponse = require('./testResponses/configMap.json')
    secretResponse = require('./testResponses/secret.json')
    serviceResponse = require('./testResponses/service.json')

    listNamespacedPodStub = sinon.stub(checker.coreV1Api, 'listNamespacedPod').resolves(JSON.parse(JSON.stringify(podResponse)))
    listNamespacedDeploymentStub = sinon.stub(checker.appsV1Api, 'listNamespacedDeployment').resolves(JSON.parse(JSON.stringify(deploymentResponse)))
    listNamespacedConfigMapStub = sinon.stub(checker.coreV1Api, 'listNamespacedConfigMap').resolves(JSON.parse(JSON.stringify(configMapResponse)))
    listNamespacedSecretStub = sinon.stub(checker.coreV1Api, 'listNamespacedSecret').resolves(JSON.parse(JSON.stringify(secretResponse)))
    listNamespacedReplicaSetStub = sinon.stub(checker.appsV1Api, 'listNamespacedReplicaSet').resolves(JSON.parse(JSON.stringify(replicaSetResponse)))
    listNamespacedServiceStub = sinon.stub(checker.coreV1Api, 'listNamespacedService').resolves(JSON.parse(JSON.stringify(serviceResponse)))
  })

  afterEach(() => {
    listNamespacedPodStub.restore()
    listNamespacedDeploymentStub.restore()
    listNamespacedConfigMapStub.restore()
    listNamespacedSecretStub.restore()
    listNamespacedReplicaSetStub.restore()
    listNamespacedServiceStub.restore()
  })

  describe('getByResourceType', () => {
    it('Should return a list of Pods on the Cluster', async () => {
      const resources = await checker.getByResourceType('POD')
      expect(resources).to.deep.equal(['kubernetes-bootcamp-57978f5f5d-mb4xw'])
    })

    it('Should return a list of Deployments on the Cluster', async () => {
      const resources = await checker.getByResourceType('DEPLOYMENT')
      expect(resources).to.deep.equal(['kubernetes-bootcamp'])
    })

    it('Should return a list of ConfigMaps on the Cluster', async () => {
      const resources = await checker.getByResourceType('CONFIGMAP')
      expect(resources).to.deep.equal(['kube-root-ca.crt'])
    })

    it('Should return a list of Secrets on the Cluster', async () => {
      const resources = await checker.getByResourceType('SECRET')
      expect(resources).to.deep.equal(['default-token-mgxkl'])
    })

    it('Should return a list of ReplicaSets on the Cluster', async () => {
      const resources = await checker.getByResourceType('REPLICASET')
      expect(resources).to.deep.equal(['kubernetes-bootcamp-57978f5f5d'])
    })

    it('Should return a list of Services on the Cluster', async () => {
      const resources = await checker.getByResourceType('SERVICE')
      expect(resources).to.deep.equal(['kubernetes'])
    })

    it('Should return undefined if there was an error getting the resources from the API', async () => {
      listNamespacedPodStub.restore()
      listNamespacedPodStub = sinon.stub(checker.coreV1Api, 'listNamespacedPod').rejects('Bang!')
      const resources = await checker.getByResourceType('POD')
      expect(resources).to.equal(undefined)
    })

    it('Should return undefined if the resource type is not supported', async () => {
      const resources = await checker.getByResourceType('SOMETHING')
      expect(resources).to.equal(undefined)
    })
  })
})
