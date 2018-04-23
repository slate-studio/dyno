'use strict'

const uuidV4           = require('uuid/v4')
const jsonRequest      = require('../../jsonRequest')
const RequestNamespace = require('../../requestNamespace')
const EventEmitter     = require('events')
const SwaggerClient    = require('swagger-client')
const Pool             = require('./pool')

const rootPath = process.cwd()
const defaults = {
  client: {
    http: {
      maxAttempts: 10,
      retryDelay:  500
    },
    pool: {
      max_retries: 10,
      retry_delay: 500
    }
  }
}

class Client extends EventEmitter {
  constructor(config) {
    super()

    this.config   = config
    this.services = {}

    if (!config.services) {
      return
    }

    for (let key in config.services) {
      const options = config.services[key]

      const { name, host } = options
      this.services[name]  = options
      this.services[name].pool = new Pool(name, host)
    }
  }

  async _buildServiceOperations({ name, host, spec }) {
    spec = require(`${rootPath}/${spec}`)
    spec.host = host

    this.services[name].client = await SwaggerClient({ spec })

    this[name] = {}

    for (let path in spec.paths) {
      const methods = spec.paths[path]

      for (let method in methods) {
        const operationId = methods[method].operationId

        if (operationId) {
          this[operationId] = async(parameters = {}, options = {}) => {
            const returnResponse = options.returnResponse || false
            delete options.returnResponse

            const params   = { operationId, parameters, options, name }
            const response = await this._execute(params)

            if (returnResponse) {
              return response
            }

            return response.object
          }

          this[name][operationId] = this[operationId]
        }
      }
    }
  }

  async _execute({ name, operationId, parameters, options }) {
    log.debug({ name, operationId, parameters, options }, `[client] ${name}.${operationId}`)

    const swaggerClient = this.services[name].client

    const requestNamespace = new RequestNamespace()
    Object.assign(options, {
      serviceName:         name,
      authenticationToken: requestNamespace.get('authenticationToken'),
      facilityScope:       requestNamespace.get('facilityScope'),
      sourceRequestId:     requestNamespace.get('sourceRequestId'),
      sourceOperationId:   requestNamespace.get('sourceOperationId'),
      requestId:           uuidV4(),
      requestParameters:   parameters,
      requestOperationId:  operationId
    })

    const requestInterceptor = requestOptions => {
      return this._requestInterceptor(requestOptions, options, name)
    }

    const params = {
      http: jsonRequest,
      operationId,
      parameters,
      requestInterceptor
    }

    return swaggerClient.execute(params)
  }

  _requestInterceptor(requestOptions, options, name) {
    if (options.authenticationToken) {
      requestOptions.headers['authorization'] = options.authenticationToken
      requestOptions.headers['scope']         = options.facilityScope
    }

    if (options.requestId) {
      requestOptions.headers['x-request-id'] = options.requestId
    }

    if (options.sourceRequestId) {
      requestOptions.headers['x-source-request-id'] = options.sourceRequestId
    }

    if (options.sourceOperationId) {
      requestOptions.headers['x-source-operation-id'] = options.sourceOperationId
    }

    requestOptions.maxAttempts = this.config.client.http.maxAttempts
    requestOptions.retryDelay  = this.config.client.http.retryDelay
    requestOptions.client      = this.services[name].pool

    if (this.config.client.request) {
      requestOptions.client = {
        request: (_requestOptions) => {
          Object.assign(_requestOptions, options)
          return this.config.client.request(_requestOptions)
        }
      }
    }
  }

  async _initializePools() {
    const clientOptions = this.config.client || defaults.client

    log.debug('[client] Pool configuration:', clientOptions.pool)

    for (const name in this.services) {
      await this.services[name].pool.initialize(this.config.client.pool)
    }
  }

  async _buildOperations() {
    for (const name in this.services) {
      await this._buildServiceOperations(this.services[name])
    }
  }

  async initialize() {
    this.config.client = this.config.client || defaults.client

    await this._initializePools()
    await this._buildOperations()
  }
}

module.exports = Client
