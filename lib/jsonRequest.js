'use strict'

const url   = require('url')
const http  = require('http')
const https = require('https')

class NetworkError extends Error {
  constructor(error) {
    super(`[network error] ${error.message}`)

    this.name          = this.constructor.name
    this.response      = null
    this.originalError = error
  }
}

class HttpError extends Error {
  constructor(response) {
    super(`[http error] ${response.object.message}`)

    this.name       = this.constructor.name
    this.statusCode = response.statusCode
    this.response   = response

    this.originalError = response.object
  }
}

const parseResponse = (res, options) => {
  const url = `${options.host}${options.path}`
  const response = {
    ok:         !(res.statusCode >= 400),
    url,
    method:     options.method,
    statusCode: res.statusCode,
    statusText: res.statusMessage,
    headers:    res.headers,
    text:       res.body,
    body:       res.body
  }

  if (response.body) {
    try {
      response.object = JSON.parse(response.body)

    } catch (error) {
      log.debug(response, 'Non-JSON response sent by server')

      response.object = {
        url,
        code:         'ParseResponseError',
        message:      'Non JSON response sent by server',
        responseBody: response.body,
        method:       options.method
      }

    }
  }

  return response
}

const request = (options) => {
  const client = options.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const req = client.request(options, res => {
      res.on('data', chunk => res.body = (res.body || '') + chunk)

      res.on('end', () => {
        let response

        try {
          response = parseResponse(res, options)

        } catch (error) {
          return reject(error)

        }

        if (!response.ok) {
          const error = new HttpError(response)
          return reject(error)
        }

        if (options.responseInterceptor) {
          options.responseInterceptor(response)
        }

        resolve(response)
      })
    })

    if (options.timeout) {
      req.setTimeout(options.timeout, () => req.abort())
    }

    req.on('error', error => {
      error = new NetworkError(error)
      return reject(error)
    })

    if (options.body) {
      let json

      if (typeof options.body == 'object') {
        json = JSON.stringify(options.body)

      } else {
        json = options.body

      }

      const buffer = new Buffer(json)
      req.write(buffer)
    }

    req.end()
  })
}

const execute = async(options) => {
  options.maxAttempts -= 1

  try {
    const response = await request(options)
    return response

  } catch (error) {
    if (error.name === 'NetworkError' && options.maxAttempts > 0) {
      log.debug(error, 'Network error')
      log.debug(`Retry request in ${options.retryDelay}ms, ${options.maxAttempts} retries left`)

      return new Promise(resolve => setTimeout(resolve, options.retryDelay))
        .then(() => execute(options))

    } else {
      throw error

    }
  }
}

module.exports = options => {
  if (options.url) {
    const urlFormat  = url.format(options.url)
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

  const _execute = options.execute || execute
  return _execute(options)
}
