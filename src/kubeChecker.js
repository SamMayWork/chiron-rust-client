const Logger = require('./logger')
const logging = new Logger('kube-checker')
const k8s = require('@kubernetes/client-node')

class KubeChecker {
  constructor () {
    this.kc = new k8s.KubeConfig()
    this.kc.loadFromCluster()

    this.coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api)
    this.appsV1Api = this.kc.makeApiClient(k8s.AppsV1Api)
  }

  /**
   * Returns all of the resources of the given type from the target namespace
   * @param {String} resourceType - Resource Type (i.e. Deployments, Pods, etc.)
   * @param {String} namespace - Namespace to get the resource from
   * @returns An Array of resources or undefined if nothing is found
   */
  async getByResourceType (resourceType, namespace) {
    try {
      let resources = []
      switch (resourceType) {
        case 'POD': {
          resources = await this.coreV1Api.listNamespacedPod(namespace)
          break
        }
        case 'DEPLOYMENT': {
          resources = await this.appsV1Api.listNamespacedDeployment(namespace)
          break
        }
        case 'SERVICE': {
          resources = await this.coreV1Api.listNamespacedService(namespace)
          break
        }
        case 'CONFIGMAP': {
          resources = await this.coreV1Api.listNamespacedConfigMap(namespace)
          break
        }
        case 'SECRET': {
          resources = await this.coreV1Api.listNamespacedSecret(namespace)
          break
        }
        case 'REPLICASET': {
          resources = await this.appsV1Api.listNamespacedReplicaSet(namespace)
          break
        }
        default:
          return undefined
      }

      return resources.body.items.map(resource => {
        return resource.metadata.name
      })
    } catch (error) {
      logging.error(error)
    }
  }
}

module.exports = {
  KubeChecker
}
