'use strict'

const _                = require('lodash')
const KeepAliveAgent   = require('agentkeepalive')
const SwaggerClient    = require('swagger-client')
const EventEmitter     = require('events')
const http             = require('http')
const url              = require('url')
const RequestNamespace = require('../../requestNamespace')

const agentSettings = {
  maxSockets:                 100,
  maxFreeSockets:             10,
  timeout:                    600000,
  freeSocketKeepAliveTimeout: 300000
}

// TODO: Rename to HttpClient
class Http {
  constructor() {
    this.swaggerClients = {}
    this.agent = new KeepAliveAgent(agentSettings)

    // TODO: This is not required.
    this.errorsMap = [ 400, 401, 403, 404, 422, 423, 500, 502 ]
  }

  initialize(config) {
    this.config = config
    return this
  }

  // TODO: Rename to createSwaggerClient.
  async registerService(serviceName, spec) {
    this.swaggerClients[serviceName] = await SwaggerClient({ spec })
  }

  send({ operationId, parameters, options, serviceName }) {
    // TODO: What http server stands for?
    log.info(`[http server]: ${serviceName}.${operationId}`, parameters)

    const swaggerClient = this._getSwaggerClient(serviceName)

    if (!swaggerClient) {
      throw new Error(`Not found SwaggerClient for service: ${serviceName}`)
    }

    // TODO: Why do it here, but not in the _updateRequest?
    const requestNamespace      = new RequestNamespace()
    options.authenticationToken = requestNamespace.get('authenticationToken')
    options.requestId           = requestNamespace.get('requestId')
    options.sourceOperationId   = requestNamespace.get('sourceOperationId')
    options.operationId         = operationId
    options.serviceName         = serviceName

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

  _updateRequest(req, { requestId, authenticationToken, sourceOperationId, operationId, serviceName }) {
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
              const httpError = getHttpError(statusCode, _.get(obj, 'message', null))
              httpError.setServiceName(request.serviceName)
              httpError.setOperationId(request.operationId)

              if (_.has(obj, 'errors')) {
                httpError.setErrors(obj.errors)
              }

              throw httpError
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

  // TODO: This method seems to be not used anymore.
  _getHttpError(statusCode, message) {
    let errorName = statusCode
    if (this.errorsMap.indexOf(statusCode) === -1) {
      errorName = `${String(statusCode)[0]}xx`
    }
    errorName = `http${errorName}`

    const HttpError = require(`./../../errors/http/${errorName}`)
    return new HttpError(message, statusCode)
  }
}

const httpClient = new Http()

// TODO: Should export client class.
exports = module.exports = httpClient
exports.Http = Http
