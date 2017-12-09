'use strict'

const _ = require('lodash')

const responseTime     = require('response-time')
const timeout          = require('connect-timeout')
const express          = require('express')
const cors             = require('cors')
const bodyParser       = require('body-parser')
const logger           = require('../../log')
const db               = require('../../db')
const msg              = require('../../msg')
const health           = require('./health')
const oas              = require('./oas')
const { createRequestNamespace } = require('./oas/requestNamespace')

const exitTimeout  = 1000

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
    const host           = _.get(this.config, 'server.host')
    const port           = _.get(this.config, 'server.port')
    const Authentication = _.get(this.config, 'service.Authentication', null)
    const requestTimeout = _.get(this.config, 'server.requestTimeout', 15000)
    const bodySizeLimit  = _.get(this.config, 'server.bodySizeLimit', '10mb')
    const corsConfig     = _.get(this.config, 'server.cors', {})

    const server = express()

    if (!Authentication) {
      log.warn('`service.Authentication` class is not defined.')
    }

    server.set('config', this.config)
    server.set('port',   port)
    server.set('Authentication', Authentication)

    server.use(bodyParser.json( { limit: bodySizeLimit } ))
    server.use(cors(corsConfig))
    server.use(responseTime())
    server.use(createRequestNamespace)
    server.use('/', health)
    server.use(timeout(requestTimeout))

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
