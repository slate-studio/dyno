'use strict'

const _ = require('lodash')

const keepAliveAgent = require('agentkeepalive')
const http           = require('http')
const url            = require('url')

const defaultAgentSettings = {
  maxSockets:                 100,
  maxFreeSockets:             10,
  timeout:                    600000,
  freeSocketKeepAliveTimeout: 300000
}

const agent = new keepAliveAgent(_.assign(defaultAgentSettings, {}))
// _.get(C, 'swagger-client.keepAliveAgentSettings', {})
// )

const errorsMap = [ 400, 401, 403, 404, 422, 423, 500, 502 ]

const getHttpError = (statusCode, error) => {
  const message = _.get(error, 'message', null)
  const stack   = _.get(error, 'stack', null)

  let errorName = statusCode
  if (errorsMap.indexOf(statusCode) === -1) {
    errorName = `${String(statusCode)[0]}xx`
  }
  errorName = `http${errorName}`

  const HttpError = require(`./../../../errors/http/${errorName}`)
  const httpError = new HttpError(message, statusCode)
  if (stack) {
    httpError.stack = stack
  }
  return httpError
}

module.exports = request => {
  return new Promise((resolve, reject) => {

    if (request.requestInterceptor) {
      request = request.requestInterceptor(request)
    }

    const urlFormat = url.format(request.url)
    const options   = url.parse(urlFormat)

    options.method  = request.method
    options.headers = request.headers
    options.agent   = agent

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
            const httpError = getHttpError(statusCode, obj)
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
