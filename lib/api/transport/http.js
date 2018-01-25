'use strict'

const _              = require('lodash')
const KeepAliveAgent = require('agentkeepalive')
const http           = require('http')
const url            = require('url')

class HttpTransport {

  constructor() {
    const agentSettings = {
      maxSockets:                 100,
      maxFreeSockets:             10,
      timeout:                    600000,
      freeSocketKeepAliveTimeout: 300000
    }

    this.agent     = new KeepAliveAgent(agentSettings)
    this.errorsMap = [ 400, 401, 403, 404, 422, 423, 500, 502 ]
  }

  _getHttpError(statusCode, message) {
    let errorName = statusCode
    if (this.errorsMap.indexOf(statusCode) === -1) {
      errorName = `${String(statusCode)[0]}xx`
    }
    errorName = `http${errorName}`

    const HttpError = require(`./../../errors/http/${errorName}`)
    return new HttpError(message, statusCode)
  }

  sendRequest(request) {
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

}

const httpTransport = new HttpTransport()

exports = module.exports = request => httpTransport.sendRequest(request)
exports.HttpTransport = HttpTransport
