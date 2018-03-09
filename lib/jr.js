'use strict'

const _     = require('lodash')
const url   = require('url')
const http  = require('http')
const https = require('https')

class NetworkError extends Error {
  constructor(error) {
    const message = error.message
    super(message)

    this.name     = this.constructor.name
    this.response = null
  }
}

class JsonParseError extends Error {
  constructor(error, response) {
    const message = error.message
    super(message)

    this.name     = this.constructor.name
    this.response = response
  }
}

class HttpError extends Error {
  constructor(response) {
    const body    = response.body
    const message = body.message || response.statusText

    super(message)
    
    this.name     = this.constructor.name
    this.response = response

    if (body.originalError) {
      this.originalError = body.originalError
    }
  }
}

const parseResponse = (res, options) => {
  const url = options.host + options.path
  const response = {
    ok:         !(res.statusCode >= 400),
    url,
    statusCode: res.statusCode,
    statusText: res.statusMessage,
    headers:    res.headers,
    text:       res.body,
    body:       res.body
  }

  return response
}

const parseResponseBody = response => {
  if (response.body) {
    try {
      return JSON.parse(response.body)

    } catch (error) {
      throw new JsonParseError(error, response)

    }
  }

  return response.body
}

module.exports = options => {
  const scheme = _.get(options, 'scheme', 'http')
  const client = scheme === 'https' ? https : http

  if (options.url) {
    const urlFormat  = url.format(options.url)
    Object.assign(options, url.parse(urlFormat))
    delete options.url
  }

  if (options.requestInterceptor) {
    options = options.requestInterceptor(options)
  }

  options.headers = options.headers || {}
  options.headers['Content-Type'] = 'application/json'

  return new Promise((resolve, reject) => {
    const req = client.request(options, res => {
      res.on('data', chunk => res.body = (res.body || '') + chunk)

      res.on('end', () => {
        const response = parseResponse(res, options)

        try {
          response.object = parseResponseBody(response)
          response.body   = response.obj

        } catch (error) {
          return reject(error)

        }

        if (!response.ok) {
          const error = new HttpError(response)
          return reject(error)
        }

        resolve(response)
      })
    })

    if (options.timeout) {
      req.setTimeout(options.timeout, () => req.abort())
    }

    req.on('error', error => {
      error = new NetworkError(error)
      reject(error)
    })

    if (options.body) {
      const json   = JSON.stringify(options.body)
      const buffer = new Buffer(json)
      req.write(buffer)
    }

    req.end()
  })
}
