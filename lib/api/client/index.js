'use strict'

const _            = require('lodash')
const EventEmitter = require('events')

class Client extends EventEmitter {

  initialize(config) {
    this.config      = config
    this.services    = this.config.services
    this.rootPath    = process.cwd()

    this.httpClient  = require('./http').initialize(this.config)
    this.redisClient = require('./redis').initialize(this.config)

    return this._buildDependentServices()
  }

  _buildDependentServices() {
    if (this.services) {
      for (let s in this.services) {
        const config = this.services[s]
        const spec   = require(`${this.rootPath}/${config.spec}`)
        spec.host    = config.host

        this._buildOperations({ spec, config })
      }
    }
  }

  async _buildOperations({ spec, config }) {
    const serviceName = config.name
    const client      = this._getClient(config)
    await client.registerService(serviceName, spec)

    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        const operationId = operation.operationId
        if (operationId) {
          this[operationId] = async function(parameters = {}, options = {}) {
            const success = await client.send({ operationId, parameters, options, serviceName })
            return success.obj
          }
        }
      })
    })
  }

  _getClient(config) {
    const host = config.host

    if (host) {
      return this.httpClient
    }

    return this.redisClient
  }
}

const client = new Client()

module.exports = client
