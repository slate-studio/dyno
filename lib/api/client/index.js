'use strict'

const uuidv4           = require('uuid/v4')
const jsonRequest      = require('../../jsonRequest')
const RequestNamespace = require('../../requestNamespace')
const EventEmitter     = require('events')
const SwaggerClient    = require('swagger-client')
const KeepAliveAgent   = require('agentkeepalive')

const defaults = {
  client: {
    http: {
      maxAttempts: 10,
      retryDelay:  500
    }
  }
}

class Client extends EventEmitter {
  constructor(config) {
    super()

    this.config         = config
    this.services       = {}
    this.rootPath       = process.cwd()
    this.keepAliveAgent = new KeepAliveAgent({
      maxSockets:                 100,
      maxFreeSockets:             10,
      timeout:                    600000,
      freeSocketKeepAliveTimeout: 300000
    })
  }

  initialize() {
    return this._buildOperations()
  }

  async _buildOperations() {
    const services = this.config.services
    if (services) {
      for (let s in services) {
        const config        = services[s]
        const name          = config.name
        this.services[name] = config

        await this._buildServiceOperations(config)
      }
    }
  }

  async _buildServiceOperations(config) {
    const name = config.name
    const spec = require(`${this.rootPath}/${config.spec}`)
    spec.host  = config.host

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
      requestId:           uuidv4(),
      requestParameters:   parameters,
      requestOperationId:  operationId
    })

    const requestInterceptor = requestOptions => {
      return this._requestInterceptor(requestOptions, options)
    }

    const params = {
      http: jsonRequest,
      operationId,
      parameters,
      requestInterceptor
    }

    return swaggerClient.execute(params)
  }

  _requestInterceptor(requestOptions, options) {
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

    const client = this.config.client || defaults.client

    requestOptions.agent       = this.keepAliveAgent
    requestOptions.maxAttempts = client.http.maxAttempts
    requestOptions.retryDelay  = client.http.retryDelay

    if (client.http.execute) {
      requestOptions.execute = (_requestOptions) => {
        Object.assign(_requestOptions, options)
        return client.http.execute(_requestOptions)
      }
    }
  }
}

module.exports = Client
