'use strict'

const logger   = require('../../log')
const bluebird = require('bluebird')
const redis    = require('redis')

bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

const connect = config => {
  config.enable_offline_queue = false
  config.retry_strategy = options => {
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('[redis] Retry time exhausted')
    }

    return Math.min(options.attempt * 100, 3000)
  }

  return new Promise(resolve => {
    const client = redis.createClient(config)

    client.on('ready', () => resolve(client), 500)
    client.on('error', error => log.error('[redis] Error:', error))
  })
}

exports = module.exports = config => {
  if (!global['log']) {
    throw new Error('Logger has to be initialized, `global.log` is not defined')
  }

  return connect(config)
}

exports.connect = connect
