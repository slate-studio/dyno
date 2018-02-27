'use strict'

const _                = require('lodash')
const KeepAliveAgent   = require('agentkeepalive')
const SwaggerClient    = require('swagger-client')
const EventEmitter     = require('events')
const http             = require('http')
const url              = require('url')
const RequestNamespace = require('../../requestNamespace')
const helpers          = require('../helpers')

const agentSettings = {
  maxSockets:                 100,
  maxFreeSockets:             10,
  timeout:                    600000,
  freeSocketKeepAliveTimeout: 300000
}

class HttpClient {

  constructor(config) {
    this.config         = config
    this.swaggerClients = {}
    this.agent          = new KeepAliveAgent(agentSettings)
  }

  async registerService(serviceName, spec) {
    this.swaggerClients[serviceName] = await SwaggerClient({ spec })
  }

  async send({ operationId, parameters, options, serviceName }) {
    log.info(`[http client]: ${serviceName}.${operationId}`, parameters)

    const swaggerClient = this._getSwaggerClient(serviceName)

    if (!swaggerClient) {
      throw new Error(`Not found SwaggerClient for service: ${serviceName}`)
    }

    options.requestCounter = await helpers.generateRequestCounter() 
    options.operationId    = operationId
    options.serviceName    = serviceName

    const requestInterceptor = req => this._updateRequest(req, options)

    const params = {
      // TODO: Not clear on why we need this at this point, we should be using
      //       default one or lib.request.
      http: this._sendRequest.bind(this),
      operationId,
      parameters,
      requestInterceptor
    }

    return swaggerClient.execute(params)
  }

  _getSwaggerClient(serviceName) {
    return this.swaggerClients[serviceName]
  }

  _updateRequest(req, { requestCounter, operationId, serviceName }) {
    const requestNamespace    = new RequestNamespace()
    const authenticationToken = requestNamespace.get('authenticationToken')
    const sourceRequestId     = requestNamespace.get('sourceRequestId')
    const requestId           = helpers.buildRequestId(sourceRequestId, requestCounter)
    const sourceOperationId   = requestNamespace.get('sourceOperationId')

    if (authenticationToken) {
      req.headers['x-authentication-token'] = authenticationToken
    }

    if (sourceRequestId) {
      req.headers['x-source-request-id'] = sourceRequestId
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

  _sendRequest(request) {
    return new Promise((resolve, reject) => {

      if (request.requestInterceptor) {
        request = request.requestInterceptor(request)
      }

      const urlFormat = url.format(request.url)
      const options   = url.parse(urlFormat)

      options.method  = request.method
      options.headers = request.headers
      options.agent   = this.agent

      const req = http.request(options, (response) => {
        let result = ''

        response.on('data', (chunk) => {
          result += chunk
        })

        response.on('end', () => {
          try {
            let obj

            if (result) {
              obj = JSON.parse(result)
            }

            const statusCode = parseInt(response.statusCode)

            if (statusCode >= 400) {
              throw this._extendError(obj, statusCode, request)
            }

            resolve({
              statusCode: response.statusCode,
              statusText: response.statusMessage,
              headers:    response.headers,
              obj:        obj,
              body:       obj,
              text:       result
            })

          } catch (e) {
            reject(e)

          }
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      if (request.body) {
        req.write(request.body)
      }

      req.end()
    })
  }

  _extendError(error, statusCode, request) {
    if (_.isEmpty(error)) {
      error = new Error(`Http error: ${response.statusCode}`)
    }

    error.statusCode  = statusCode
    error.serviceName = request.serviceName
    error.operationId = request.operationId

    return error
  }
}

exports = module.exports = HttpClient
