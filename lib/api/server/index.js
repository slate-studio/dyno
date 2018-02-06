'use strict'

const _  = require('lodash')
const os = require("os")

const logger       = require('../../log')
const db           = require('../../db')
const msg          = require('../../msg')
const { URL }      = require('url')
const request      = require('../../request')
// TODO: Dumb copypaste
const HttpServer   = require('./http')
const RedisServer  = require('./redis')

const EXIT_TIMEOUT = 1000

class Server {
  constructor(config) {
    this.config = config
    this.apiClient = require('../client')
    this._setInstanceId()
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

  // async setPublicKey(server) {
  //   const publicKeyUrl = _.get(this.config, 'service.publicKeyUrl')

  //   if (publicKeyUrl) {
  //     const url     = new URL(publicKeyUrl)
  //     const scheme  = url.protocol.replace(':', '')
  //     const options = {
  //       scheme,
  //       host: url.host,
  //       port: url.port,
  //       path: url.pathname
  //     }

  //     const response = await request(options)
  //     server.set('publicKey', response.object)
  //   }
  // }

  async createHttpServer() {
    this.httpServer = new HttpServer(this.config)
    return this.httpServer.initialize()
  }

  async createRedisServer() {
    this.redisServer = new RedisServer(this.config)
    return this.redisServer.initialize()
  }

  initialize() {
    return this.logger()
      .then(() => this.connectDatabases())
      .then(() => this.apiClient.initialize(this.config))
      .then(() => global.Services = this.apiClient)
      .then(() => this.connectMsg())
      .then(() => this.createRedisServer())
      .then(() => this.createHttpServer())
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

  _setInstanceId() {
    this.config.server.instanceId = os.hostname()
  }
}

exports = module.exports = config => {
  const server = new Server(config)
  return server.listen()
}

exports.Server = Server
