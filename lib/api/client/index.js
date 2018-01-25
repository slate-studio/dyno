'use strict'

const _                = require('lodash')
const SwaggerClient    = require('swagger-client')
const EventEmitter     = require('events')
// const mock             = require('./mock')
const RequestNamespace = require('../../requestNamespace')

const IS_TEST_ENVIRONMENT = [ 'test', 'gitlab' ].indexOf(process.env.NODE_ENV) > -1

class ApiClient extends EventEmitter {

  initialize(config) {
    this.services    = config.services
    this.rootPath    = process.cwd()

    this.httpTransport  = require('../transport/http')
    this.redisTransport = require('../transport/redis')

    return this._buildDependentServices()
  }

  async _buildDependentServices() {
    if (this.services) {
      for (let s in this.services) {
        const config = this.services[s]
        const spec   = require(`${this.rootPath}/${config.spec}`)
        const host   = config.host
        const params = { spec, config }

        if (host) {
          spec.host            = host
          params.swaggerClient = await SwaggerClient({ spec })
        }

        this._buildOperations(params)

        if (IS_TEST_ENVIRONMENT) {
          // mock(this.name, spec)
        }
      }
    }
  }

  _buildOperations(params) {
    const { spec } = params

    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        const operationId = operation.operationId
        if (operationId) {
          this[operationId] = function(parameters = {}, options = {}) {
            _.assign(params, { operationId, parameters, options })
            return this._execute(params)
          }
        }
      })
    })
  }

  _updateHttpRequest(req, { requestId, authenticationToken, sourceOperationId, operationId, serviceName }) {
    if (authenticationToken) {
      req.headers['x-authentication-token'] = authenticationToken
    }

    if (requestId) {
      req.headers['x-request-id'] = requestId
    }

    if (sourceOperationId) {
      req.headers['x-source-operation-id'] = sourceOperationId
    }

    req.serviceName = serviceName
    req.operationId = operationId

    return req
  }

  _execute({ operationId, parameters, options, swaggerClient, config }) {
    const { name } = config

    log.info(`${name}.${operationId}`, parameters)

    if (swaggerClient) {
      const requestNamespace      = new RequestNamespace()
      options.authenticationToken = requestNamespace.get('authenticationToken')
      options.requestId           = requestNamespace.get('requestId')
      options.sourceOperationId   = requestNamespace.get('sourceOperationId')
      options.operationId         = operationId
      options.serviceName         = name

      const requestInterceptor = req => this._updateHttpRequest(req, options)

      const params = { 
        http: this.httpTransport,
        operationId,
        parameters,
        requestInterceptor
      }

      return swaggerClient.execute(params)
    }

    return new Promise(resolve => {
      const callback = msg => resolve(msg.object)

      this.redisTransport.sendRequest({
        operationId,
        parameters,
        callback
      })
    })
  }
}

const apiClient = new ApiClient()

module.exports = apiClient
