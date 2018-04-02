'use strict'

const cors = require('cors')

const allowedHeaders = [
  'authorization',
  'content-type',
  'scope'
]

const exposedHeaders = [
  'x-request-id',
  'x-response-time',
  'x-page',
  'x-per-page',
  'x-pages-count',
  'x-total-count',
  'x-next-page'
]

module.exports = (instanceUri, options = {}) => {
  options.credentials    = true
  options.allowedHeaders = allowedHeaders.join(',')
  options.exposedHeaders = exposedHeaders.join(',')

  if (instanceUri) {
    const instanceSubdomain = instanceUri.split('//')[1].split('.')[0]

    const origin = (origin, callback) => {
      if (!origin || origin == 'file://') {
        return callback(null, false)
      }

      if (origin.split('//').length == 0) {
        return callback(null, false)
      }

      const subdomain = origin.split('//')[1].split('.')[0]
      origin = instanceUri.replace(`${subdomain}.`, `${instanceSubdomain}.`)

      if (origin == instanceUri) {
        return callback(null, true)

      } else {
        return callback(null, false)

      }
    }

    options.origin = options.origin || origin
  }

  return cors(options)
}
