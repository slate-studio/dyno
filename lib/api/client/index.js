'use strict'

const _            = require('lodash')
const EventEmitter = require('events')

class Client extends EventEmitter {
  initialize(config) {
    this.config   = config
    this.services = this.config.services
    this.rootPath = process.cwd()

    // TODO: This is weird interface, new HttpClient() and new RedisClient()
    //       should be called.
    this.httpClient  = require('./http').initialize(this.config)
    this.redisClient = require('./redis').initialize(this.config)

    return this._buildDependentServices()
  }

  // TODO: Bad method name, you're not building service but building client
  //       operations.
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
          // TODO: This probably also need to support client.service.operation
          //       interface to be complient with the old code.
          this[operationId] = async function(parameters = {}, options = {}) {
            const response = await client.send({ operationId, parameters, options, serviceName })

            // TODO: Sometimes we need full response but not just object,
            //       e.g. to check headers.
            return response.obj
          }
        }
      })
    })
  }

  // TOOD: Just pass host as a parameter.
  _getClient(config) {
    const host = config.host

    if (host) {
      return this.httpClient
    }

    return this.redisClient
  }
}

// TODO: Client should not be created here, class should be exported.
const client = new Client()

module.exports = client
