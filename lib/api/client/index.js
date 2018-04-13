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
      keep_alive:  true,
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

    const clientOptions = this.config.client || defaults.client

    requestOptions.maxAttempts = clientOptions.http.maxAttempts
    requestOptions.retryDelay  = clientOptions.http.retryDelay
    requestOptions.client      = this.services[name].pool

    if (client.http.execute) {
      requestOptions.execute = (_requestOptions) => {
        Object.assign(_requestOptions, options)
        return client.http.execute(_requestOptions)
      }
    }
  }

  async _initializePools() {
    const clientOptions = this.config.client || defaults.client

    for (const name in this.services) {
      this.services[name].pool.initialize(clientOptions.pool)
    }
  }

  async _buildOperations() {
    for (const name in this.services) {
      await this._buildServiceOperations(this.services[name])
    }
  }

  async initialize() {
    await this._initializePools()
    await this._buildOperations()
  }
}

module.exports = Client
