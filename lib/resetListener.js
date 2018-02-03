#!/usr/bin/env node

'use strict'

const RESET_REQUESTS_TOPIC = 'resetRequests'
const RESET_RESPONSE_QUEUE = 'resetResponses'

const config  = require('config')
const spawn   = require('child_process').spawn
const fs      = require('fs')
const _       = require('lodash')

const logger  = require('./log')
const request = require('./request')
const msg     = require('./msg')
const db      = require('./db')

const name = _.get(config, 'service.name', 'NO_NAME')
const host = _.get(config, 'server.host')
const port = _.get(config, 'server.port')

const exitTimeout    = 1000
const rootPath       = process.cwd()
const SEED_DATA_PATH = `${rootPath}/db/seed`
const SEED_TEST_PATH = `${rootPath}/db/test`

const stopService = () => {
  log.info(`Stop ${name}`)
  const stop = spawn('pm2', [ 'stop', name ])

  return new Promise((resolve, reject) => {
    stop.stderr.on('data', (err) => reject(err))
    stop.on('close', resolve)
  })
}

const waitForService = (next) => {
  const options = {
    hostname: host,
    port:     parseInt(port),
    path:     '/health',
    method:   'GET'
  }

  request(options)
    .then(next)
    .catch(err => {
      log.error(err)
      log.info(`Waiting for ${name}...`)
      _.delay(() => waitForService(next), 2000)
    })
}

const startService = () => {
  log.info(`Start ${name}`)
  const start = spawn('pm2', [ 'restart', name ])

  return new Promise((resolve, reject) => {
    start.stderr.on('data', (err) => reject(err))
    start.on('close', () => waitForService(resolve))
  })
}

const seedData = () => {
  if (fs.existsSync(SEED_DATA_PATH)) {
    return require(SEED_DATA_PATH)
  }

  return Promise.resolve()
}

const seedTestData = () => {
  if (fs.existsSync(SEED_TEST_PATH)) {
    return require(SEED_TEST_PATH)
  }

  return Promise.resolve()
}

const proc = (msg, options = {}) => {
  const { object } = msg
  const queue      = RESET_RESPONSE_QUEUE

  const isMentioned = _.includes(object.services, name)

  if (!isMentioned) {
    return
  }

  log.info('RESET REQUEST:', object)

  const _afterStop  = options.afterStop  || Promise.resolve
  const _afterDrop  = options.afterDrop  || Promise.resolve
  const _afterStart = options.afterStart || Promise.resolve

  const _seedData     = object.seed     ? seedData     : Promise.resolve
  const _seedTestData = object.seedTest ? seedTestData : Promise.resolve

  return Promise.resolve()
    .then(stopService)
    .then(_afterStop)
    .then(() => require('./db/mongodb/bin/drop'))
    .then(_afterDrop)
    .then(_seedData)
    .then(_seedTestData)
    .then(startService)
    .then(_afterStart)
    .then(() => {
      const message = Message({
        jobId: object.jobId,
        service: {
          name:   name,
          status: 'complete'
        }
      })

      return message.send(queue)
    })
    .then(() => {
      log.info('Request successfully processed.')
      setTimeout(() => process.exit(0), exitTimeout)
    })
    .catch(err => {
      log.error(err)

      const message = Message({
        jobId: object.jobId,
        service: {
          name:   name,
          status: 'error',
          error:  err.toString()
        }
      })

      return message.send(queue)
        .then(startService)
        .then(() => {
          setTimeout(() => process.exit(1), exitTimeout)
        })
    })
}

const listen = (topic = RESET_REQUESTS_TOPIC, callback = proc) => {
  const handlers = {}
  handlers[`${topic}.resetRequest`] = callback

  const listener = Listener(handlers)
  return listener.listen()
}

exports = module.exports = logger(config)
  .then(() => msg(config))
  .then(({ globals }) => {
    global.Message  = globals.Message
    global.Listener = globals.Listener
  })
  .then(() => listen())
  .then(() => log.info('Reset listener started'))
