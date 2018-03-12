'use strict'

const uuidv4        = require('uuid/v4')
const jsonRequest   = require('../../jsonRequest')
const mock          = require('./mock')
const EventEmitter  = require('events')
const SwaggerClient = require('swagger-client')

const KeepAliveAgent   = require('agentkeepalive')
const agentSettings = {
  maxSockets:                 100,
  maxFreeSockets:             10,
  timeout:                    600000,
  freeSocketKeepAliveTimeout: 300000
}

const IS_TEST_ENVIRONMENT = [ 'test', 'gitlab' ].indexOf(process.env.NODE_ENV) > -1

class Client extends EventEmitter {

  initialize(config) {
    this.config         = config
    this.services       = {}
    this.rootPath       = process.cwd()
    this.keepAliveAgent = new KeepAliveAgent(agentSettings)

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

    if (IS_TEST_ENVIRONMENT) {
      mock(name, spec)
    }

    this[name] = {}

    for (let path in spec.paths) {
      const methods = spec.paths[path]

      for (let method in methods) {
        const operationId = methods[method].operationId

        if (operationId) {
          this[operationId] = async (parameters = {}, options = {}) => {
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

  async _execute({ serviceName, operationId, parameters, options }) {
    log.info(`[http client]: ${serviceName}.${operationId}`, parameters)

    const swaggerClient = this.services[serviceName].client

    const requestNamespace = new RequestNamespace()
    Object.assign(options, {
      serviceName,
      operationId,
      authenticationToken: requestNamespace.get('authenticationToken'),
      facilityScope:       requestNamespace.get('facilityScope'),
      requestId:           uuidv4(),
      sourceRequestId:     requestNamespace.get('sourceRequestId'),
      sourceOperationId:   requestNamespace.get('sourceOperationId')

    })

    const requestInterceptor = req => this._requestInterceptor(req, options)
    const errorInterceptor   = error => this._errorInterceptor(error, options)

    const params = {
      http: jsonRequest,
      operationId,
      parameters,
      requestInterceptor,
      errorInterceptor
    }

    return swaggerClient.execute(params)
  }

  _errorInterceptor(error, options) {
    error.service           = options.serviceName
    error.operationId       = options.operationId
    error.sourceOperationId = options.sourceOperationId
    error.requestId         = options.requestId
    error.sourceRequestId   = options.sourceRequestId
  }

  _requestInterceptor(req, options) {
    if (options.authenticationToken) {
      req.headers['authorization'] = options.authenticationToken
      req.headers['scope']         = options.facilityScope
    }

    if (options.requestId) {
      req.headers['x-request-id'] = options.requestId
    }

    if (options.sourceRequestId) {
      req.headers['x-source-request-id'] = options.sourceRequestId
    }

    if (options.sourceOperationId) {
      req.headers['x-source-operation-id'] = options.sourceOperationId
    }

    req.agent = this.keepAliveAgent
  }
}

module.exports = Client
