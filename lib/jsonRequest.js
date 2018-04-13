'use strict'

const url = require('url')
const httpRequest = require('./httpRequest')

class JsonRequestError extends Error {
  constructor(response) {
    super(response.object.message)

    this.name       = this.constructor.name
    this.statusCode = response.statusCode
    this.response   = response

    this.originalError = response.object
  }
}

class JsonRequest {
  constructor(options) {
    if (options.url) {
      const urlFormat = url.format(options.url)
      Object.assign(options, url.parse(urlFormat))
      delete options.url
    }

    options.maxAttempts = options.maxAttempts || 1
    options.retryDelay  = options.retryDelay  || 500

    if (options.requestInterceptor) {
      options.requestInterceptor(options)
    }

    options.headers = options.headers || {}
    options.headers['Content-Type'] = 'application/json'
    options.headers['Accept']       = 'application/json'

    if (!options.method) {
      options.method = 'GET'
    }

    if (typeof options.body == 'object') {
      options.body = JSON.stringify(options.body)
    }

    this.client  = options.client || httpRequest
    this.options = options
  }

  _parseResponse(res, options) {
    const { method, host, path } = this.options

    const url = `${host}${path}`
    const ok  = !(res.statusCode >= 400)

    const response = {
      ok,
      url,
      method,
      statusCode: res.statusCode,
      statusText: res.statusMessage,
      headers:    res.headers,
      text:       res.body,
      body:       res.body
    }

    const responseBody = response.body

    if (responseBody) {
      try {
        response.object = JSON.parse(responseBody)

      } catch (error) {
        log.debug('Non JSON response sent by server:', responseBody)

        response.object = {
          code:    'ParseJsonResponseError',
          message: 'Non JSON response sent by server',
          url,
          method,
          responseBody
        }
      }
    }

    return response
  }

  async execute() {
    let res = await this.client.request(this.options)
    res = this._parseResponse(res)

    if (!res.ok) {
      throw new JsonRequestError(res)
    }

    if (this.options.responseInterceptor) {
      this.options.responseInterceptor(res)
    }

    return res
  }
}

module.exports = options => {
  const jsonRequest = new JsonRequest(options)
  return jsonRequest.execute()
}
