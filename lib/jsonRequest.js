'use strict'

const url   = require('url')
const http  = require('http')
const https = require('https')

const { normalizeError } = require('./api/errors')

class NetworkError extends Error {
  constructor(error) {
    super('Network error')

    this.name          = this.constructor.name
    this.response      = null
    this.originalError = error
  }
}

class ParseResponseError extends Error {
  constructor(error, response) {
    super('Parse response error')

    this.name          = this.constructor.name
    this.response      = response
    this.originalError = error
  }
}

class HttpError extends Error {
  constructor(response) {
    super('Http error')
    
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
      throw new ParseResponseError(error, response)

    }
  }

  return response
}

module.exports = options => {
  if (options.url) {
    const urlFormat  = url.format(options.url)
    Object.assign(options, url.parse(urlFormat))
    delete options.url
  }

  if (options.requestInterceptor) {
    options.requestInterceptor(options)
  }

  options.headers = options.headers || {}
  options.headers['Content-Type'] = 'application/json'
  options.headers['Accept']       = 'application/json'

  if (!options.method) {
    options.method = 'GET'
  }

  const scheme = options.scheme || 'http'
  const client = scheme === 'https' ? https : http

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
      const json   = JSON.stringify(options.body)
      const buffer = new Buffer(json)
      req.write(buffer)
    }

    req.end()
  })
}
