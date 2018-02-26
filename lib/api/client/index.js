'use strict'

const _            = require('lodash')
const mock         = require('./mock')
const EventEmitter = require('events')
const HttpClient   = require('./http')
const RedisClient  = require('./redis')

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
    this.httpClient  = new HttpClient(this.config)
    this.redisClient = new RedisClient(this.config)

    return this._buildClientOperations()
  }

  async _buildClientOperations() {
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
    const client      = this._getClient(config.host)
    await client.registerService(serviceName, spec)

    if (IS_TEST_ENVIRONMENT) {
      mock(serviceName, client, spec)
    }

    this[serviceName] = {}

    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        const operationId = operation.operationId

        if (operationId) {
          this[operationId] = async function(parameters = {}, options = {}) {
            const rawResponse = options.rawResponse
            delete options.rawResponse

            const params = { operationId, parameters, options, serviceName }
            const response = await client.send(params)

            if (rawResponse) {
              return response
            }

            return response.obj
          }

          this[serviceName][operationId] = this[operationId]
        }
      })
    })
  }

  _getClient(host) {
    if (host) {
      return this.httpClient
    }

    return this.redisClient
  }
}

const client = new Client()

module.exports = client
