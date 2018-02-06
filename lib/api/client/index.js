'use strict'

const _            = require('lodash')
const mock         = require('./mock')
const EventEmitter = require('events')

const IS_TEST_ENVIRONMENT = [ 'test', 'gitlab' ].indexOf(process.env.NODE_ENV) > -1

class Client extends EventEmitter {

  constructor() {
    super()
    this.initialized = false
  }

  initialize(config) {
    if (this.initialized) {
      log.debug('Client has already initialized')
      return
    }

    this.initialized = true
    this.config      = config
    this.services    = this.config.services
    this.rootPath    = process.cwd()

    this.httpClient  = require('./http').initialize(this.config)
    this.redisClient = require('./redis').initialize(this.config)

    return this._buildDependentServices()
  }

  async _buildDependentServices() {
    if (this.services) {
      for (let s in this.services) {
        const config = this.services[s]
        const spec   = require(`${this.rootPath}/${config.spec}`)
        spec.host    = config.host

        await this._buildOperations({ spec, config })
      }
    }
  }

  async _buildOperations({ spec, config }) {
    const serviceName = config.name
    const client      = this._getClient(config)
    await client.registerService(serviceName, spec)

    if (IS_TEST_ENVIRONMENT) {
      mock(serviceName, client, spec)
    }

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
