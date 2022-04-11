const Logger = require('./logger')
const logging = new Logger('kube-checker')
const k8s = require('@kubernetes/client-node')
const { setTimeout } = require('timers/promises')

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
  async getByResourceType (resourceType, namespace = 'default') {
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
          logging.warn('getByResourceType called but did not match a resource type')
          return undefined
      }

      return resources.body.items.map(resource => {
        return resource.metadata.name
      })
    } catch (error) {
      logging.error(error)
    }
  }

  /**
   * Cleans the cluster, removing any created resources
   */
  async cleanAll () {
    logging.info('Beginning Restart of the Resources')
    try {
      const resources = {
        deployments: await this.getByResourceType('DEPLOYMENT'),
        services: await this.getByResourceType('SERVICE'),
        configmaps: await this.getByResourceType('CONFIGMAP'),
        secrets: await this.getByResourceType('SECRET')
      }

      resources.deployments.forEach(async deployment => {
        await this.appsV1Api.deleteNamespacedDeployment(deployment, 'default')
      })

      resources.configmaps.forEach(async configmap => {
        if (configmap === 'kube-root-ca.crt') {
          return
        }
 
        await this.coreV1Api.deleteNamespacedConfigMap(configmap, 'default')
      })

      resources.secrets.forEach(async secret => {
        if (secret.includes('default-token')) {
          return
        }

        await this.coreV1Api.deleteNamespacedSecret(secret, 'default')
      })

      resources.services.forEach(async service => {
        if (service === 'kubernetes') {
          return
        }

        await this.coreV1Api.deleteNamespacedService(service, 'default')
      })

      return this.isClusterClear()
    } catch (error) {
      logging.error(error)
    }
  }

  async isClusterClear () {
    while (true) {
      await setTimeout(200)
      const pods = await this.getByResourceType('POD')
      if (pods.length === 0) {
        return
      }
    }
  }
}

module.exports = {
  KubeChecker
}
