'use strict'

const _             = require('lodash')
const uuidv4        = require('uuid/v4')
const jr            = require('../../jr')
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
    this.services       = this.config.services
    this.rootPath       = process.cwd()
    this.swaggerClients = {}
    this.agent          = new KeepAliveAgent(agentSettings)

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
    this.swaggerClients[serviceName] = await SwaggerClient({ spec })

    if (IS_TEST_ENVIRONMENT) {
      mock(serviceName, spec)
    }

    this[serviceName] = {}

    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        const operationId = operation.operationId

        if (operationId) {
          this[operationId] = async (parameters = {}, options = {}) => {
            const rawResponse = options.rawResponse
            delete options.rawResponse

            const params   = { operationId, parameters, options, serviceName }
            const response = await this._execute(params)

            if (rawResponse) {
              return response
            }

            return response.object
          }

          this[serviceName][operationId] = this[operationId]
        }
      })
    })
  }

  async _execute({ operationId, parameters, options, serviceName }) {
    log.info(`[http client]: ${serviceName}.${operationId}`, parameters)

    const swaggerClient = this._getSwaggerClient(serviceName)

    if (!swaggerClient) {
      throw new Error(`Not found SwaggerClient for service: ${serviceName}`)
    }

    const requestNamespace = new RequestNamespace()
    Object.assign(options, {
      authenticationToken: requestNamespace.get('authenticationToken'),
      facilityScope:       requestNamespace.get('facilityScope'),
      requestId:           uuidv4(),
      sourceRequestId:     requestNamespace.get('sourceRequestId'),
      sourceOperationId:   requestNamespace.get('sourceOperationId')

    })

    const requestInterceptor = req => this._updateRequest(req, options)

    const params = {
      http: jr,
      operationId,
      parameters,
      requestInterceptor
    }

    try {
      return swaggerClient.execute(params)

    } catch (err) {
      err.serviceName       = serviceName
      err.operationId       = operationId
      err.sourceOperationId = options.sourceOperationId
      err.requestId         = options.requestId
      err.sourceRequestId   = options.sourceRequestId

      throw err

    }
  }

  _updateRequest(req, options) {
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

    req.agent = this.agent

    return req
  }

  _getSwaggerClient(serviceName) {
    return this.swaggerClients[serviceName]
  }
}

module.exports = Client
