'use strict'

const _ = require('lodash')

const responseTime = require('response-time')
const timeout      = require('connect-timeout')
const express      = require('express')
const logger       = require('../../log')
const db           = require('../../db')
const msg          = require('../../msg')
const health       = require('./health')
const oas          = require('./oas')

const exitTimeout      = 1000
const executionTimeout = 15000

class Server {
  constructor(config) {
    this.config = config
    this.buildApiClient = require('../../../src/swagger/client')
  }

  logger() {
    return logger(this.config)
  }

  connectDatabases() {
    const mongodbConfig = _.get(this.config, 'mongodb')
    const redisConfig   = _.get(this.config, 'redis')

    return Promise.resolve()
      .then(() => {
        if (mongodbConfig) {
          return db.mongodb(mongodbConfig)
            .then(({ globals }) => {
              global.Model  = globals.Model
              global.Schema = globals.Schema
            })
        }
      })
      .then(() => {
        if (redisConfig) {
          return db.redis(redisConfig)
            .then(client => global.redis = client)
            .then(() => {
              const { host, port } = redisConfig
              log.info('[database] Redis connected to', { host, port })
            })
        }
      })
  }

  connectMsg() {
    return msg(this.config)
      .then(({ globals }) => {
        global.Message  = globals.Message
        global.Listener = globals.Listener
      })
  }

  createServer() {
    const host      = _.get(this.config, 'server.host')
    const port      = _.get(this.config, 'server.port')
    const publicKey = _.get(this.config, 'service.publicKey')

    const server = express()

    server.set('config',    this.config)
    server.set('port',      port)
    server.set('publicKey', publicKey)

    server.use(responseTime())
    server.use('/', health)
    server.use(timeout(executionTimeout))

    return new Promise(resolve => {
      oas(server, { host, port }, () => {
        server.use((error, req, res, next) => {
          log.error(error)

          const response = _.pick(error, [ 'name', 'message', 'stack' ])
          res.status(error.statusCode || 500).json(response)
        })

        resolve(server)
      })
    })
  }

  initialize() {
    return this.logger()
      .then(() => this.buildApiClient(this.config))
      .then(() => this.connectDatabases())
      .then(() => this.connectMsg())
      .then(() => this.createServer())
  }

  listen() {
    return Promise.resolve()
      .then(() => this.initialize())
      .then(api => {
        const port = api.get('port')

        log.info(`[api] Listening on port ${port}`)
        return new Promise(resolve => api.listen(port, () => resolve(api)))
      })
      .catch(error => {
        log.fatal('[api] Initialization error: ', error)
        setTimeout(() => process.exit(1), exitTimeout)
      })
  }
}

exports = module.exports = config => {
  const server = new Server(config)
  return server.listen()
}

exports.Server = Server
