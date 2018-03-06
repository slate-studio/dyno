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

const extendError = (error, statusCode, request) => {
  if (_.isEmpty(error)) {
    error = new Error()
  }

  error.statusCode  = statusCode
  error.serviceName = request.serviceName
  error.operationId = request.operationId

  return error
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
        
        let obj

        if (result) {
          try {
            obj = JSON.parse(result)
          
          } catch (e) {
            log.error(err, { result, request })
            reject(e)

          }
        }

        const statusCode = parseInt(response.statusCode)

        if (statusCode >= 400) {
          throw extendError(obj, statusCode, request)
        }

        resolve({
          statusCode: response.statusCode,
          statusText: response.statusMessage,
          headers:    response.headers,
          obj:        obj,
          body:       obj,
          text:       result
        })
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
