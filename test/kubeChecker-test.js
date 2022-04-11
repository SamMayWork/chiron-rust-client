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

  describe('cleanAll', () => {
    it('Should remove all of the created resources on the cluster', async () => {
      const getByResourceTypeStub = sinon.stub(checker, 'getByResourceType').callsFake((resource) => {
        switch (resource) {
          case 'POD':
            return ['basic-pod-a', 'basic-pod-b', 'basic-pod-c']
          case 'DEPLOYMENT':
            return ['basic-deployment-a', 'basic-deployment-b', 'basic-deployment-c']
          case 'REPLICASET':
            return ['basic-rs-a', 'basic-rs-b', 'basic-rs-c']
          case 'SERVICE':
            return ['basic-service-a', 'basic-service-b', 'basic-service-c', 'kubernetes']
          case 'CONFIGMAP':
            return ['basic-configmap-a', 'basic-configmap-b', 'basic-configmap-c', 'kube-root-ca.crt']
          case 'SECRET':
            return ['basic-secret-a', 'basic-secret-b', 'basic-secret-c', 'default-token-abc']
        }
      })
      const isClusterClearStub = sinon.stub(checker, 'isClusterClear')

      const deleteDeploymentStub = sinon.stub(checker.appsV1Api, 'deleteNamespacedDeployment')
      const deleteConfigMapStub = sinon.stub(checker.coreV1Api, 'deleteNamespacedConfigMap')
      const deleteSecretStub = sinon.stub(checker.coreV1Api, 'deleteNamespacedSecret')
      const deleteServiceStub = sinon.stub(checker.coreV1Api, 'deleteNamespacedService')

      await checker.cleanAll()

      expect(deleteDeploymentStub.callCount).to.equal(3)
      expect(deleteConfigMapStub.callCount).to.equal(3)
      expect(deleteSecretStub.callCount).to.equal(3)
      expect(deleteServiceStub.callCount).to.equal(3)
      expect(isClusterClearStub.callCount).to.equal(1)

      deleteDeploymentStub.restore()
      deleteConfigMapStub.restore()
      deleteSecretStub.restore()
      deleteServiceStub.restore()
      isClusterClearStub.restore()
      getByResourceTypeStub.restore()
    })

    it('Should return if something errors without throwing', async () => {
      const getByResourceTypeStub = sinon.stub(checker, 'getByResourceType').throws(new Error('BANG!'))
      await checker.cleanAll()
      getByResourceTypeStub.restore()
    })
  })

  describe('isClusterClear', () => {
    it('Should resolve true if there are no pods on the cluster', async () => {
      const getByResourceTypeStub = sinon.stub(checker, 'getByResourceType').resolves([])
      await checker.isClusterClear()
      getByResourceTypeStub.restore()
    })

    it('Should resolve true eventually if there are pods on the cluster but they then get removed', async () => {
      const getByResourceTypeStub = sinon.stub(checker, 'getByResourceType')
      getByResourceTypeStub.onCall(0).resolves(['something'])
      getByResourceTypeStub.onCall(1).resolves([])
      await checker.isClusterClear()
      getByResourceTypeStub.restore()
    })
  })
})
