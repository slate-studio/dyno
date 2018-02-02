'use strict'

const _        = require('lodash')
const bluebird = require('bluebird')
const redis    = require('redis')

bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

const REDIS_TIMEOUT = 500

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

    client.on('error', error => log.error('[redis] Error:', error))
    client.on('ready', () => resolve(client))
  })
}

const duplicateClient = client => {
  const duplicateClient = client.duplicate()

  return new Promise((resolve, reject) => {
    duplicateClient.on('error', reject)
    duplicateClient.on('ready', () => resolve(duplicateClient))
  })
}

const listenQueueBasedList = ({ client, queues, callback, delay = 1 }) => {
  const args = _.clone(queues)
  args.push(delay)

  const listen = async() => {
    let value

    try {
      value = await client.brpopAsync(args)
    } catch (error) {
      log.error(error)
      log.info(`[redis listener] Restart listener in ${REDIS_TIMEOUT}ms`)

      return setTimeout(listen, REDIS_TIMEOUT)
    }

    if (value) {
      callback(value)
    }

    listen()
  }

  listen()
  log.info('[redis listener] Listen queues:', queues)
}

exports = module.exports = config => {
  if (!global['log']) {
    throw new Error('Logger has to be initialized, `global.log` is not defined')
  }

  return connect(config)
}

exports.connect              = connect
exports.duplicateClient      = duplicateClient
exports.listenQueueBasedList = listenQueueBasedList
