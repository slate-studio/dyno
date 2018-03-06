'use strict'

const _ = require('lodash')

const express      = require('express')
const cors         = require('cors')
const bodyParser   = require('body-parser')
const logger       = require('../../log')
const db           = require('../../db')
const msg          = require('../../msg')
const health       = require('./health')
const oas          = require('./oas')
const { URL }      = require('url')
const request      = require('../../request')
const responseTime = require('response-time')
const { createRequestNamespace } = require('./oas/requestNamespace')

const EXIT_TIMEOUT = 1000

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

  async setPublicKey(server) {
    const publicKeyUrl = _.get(this.config, 'service.publicKeyUrl')

    if (publicKeyUrl) {
      const url     = new URL(publicKeyUrl)
      const scheme  = url.protocol.replace(':', '')
      const options = {
        scheme,
        host: url.host,
        port: url.port,
        path: url.pathname
      }

      const response = await request(options)
      server.set('publicKey', response.object)
    }
  }

  async createServer() {
    const host           = _.get(this.config, 'server.host')
    const port           = _.get(this.config, 'server.port')
    const bodySizeLimit  = _.get(this.config, 'server.bodySizeLimit', '10mb')
    const corsConfig     = _.get(this.config, 'server.cors', {})
    const Authentication = _.get(this.config, 'service.Authentication', null)
    const swaggerHandler = _.get(this.config, 'service.swaggerHandler', null)

    const server = express()

    if (!Authentication) {
      log.warn('`service.Authentication` class is not defined.')
    }

    await this.setPublicKey(server)

    server.set('config', this.config)
    server.set('port',   port)
    server.set('Authentication', Authentication)
    server.set('swaggerHandler', swaggerHandler)

    server.use(bodyParser.json( { limit: bodySizeLimit } ))
    server.use(cors(corsConfig))
    server.use(responseTime())
    server.use(createRequestNamespace)
    server.use('/', health)

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
        setTimeout(() => process.exit(1), EXIT_TIMEOUT)
      })
  }
}

exports = module.exports = config => {
  const server = new Server(config)
  return server.listen()
}

exports.Server = Server
