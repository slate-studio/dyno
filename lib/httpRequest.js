'use strict'

const http  = require('http')
const https = require('https')

class NetworkError extends Error {
  constructor(error) {
    super(error.message)

    this.name          = this.constructor.name
    this.response      = null
    this.originalError = error
  }
}

const httpRequest = options => {
  const client = options.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const req = client.request(options, res => {
      res.on('data', chunk => res.body = (res.body || '') + chunk)

      res.on('end', () => resolve(res))
    })

    if (options.timeout) {
      req.setTimeout(options.timeout, () => req.abort())
    }

    req.on('error', error => reject(new NetworkError(error)))

    if (options.body) {
      const buffer = new Buffer(options.body)
      req.write(buffer)
    }

    req.end()
  })
}

const request = async(options) => {
  options.maxAttempts -= 1

  try {
    const res = await httpRequest(options)
    return res

  } catch (error) {
    if (error.name === 'NetworkError' && options.maxAttempts > 0) {
      log.debug(error)
      log.debug(`Retry request in ${options.retryDelay}ms, ${options.maxAttempts} retries left`)

      return new Promise(resolve => setTimeout(resolve, options.retryDelay))
        .then(() => request(options))

    } else {
      throw error

    }
  }
}

module.exports = { request, NetworkError }
