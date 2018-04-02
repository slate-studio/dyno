'use strict'

const _ = require('lodash')

const express      = require('express')
const middleware   = require('./middleware')
const bodyParser   = require('body-parser')
const cookieParser = require('cookie-parser')
const logger       = require('../../log')
const db           = require('../../db')
const health       = require('./health')
const oas          = require('./oas')
const { URL }      = require('url')
const responseTime = require('response-time')
const helmet       = require('helmet')
const useragent    = require('express-useragent')

const Client       = require('../client')

const AWS          = require('aws-sdk')
const Credstash    = require('nodecredstash')

const { createRequestNamespace } = require('./oas/requestNamespace')
const authorizationCookie        = require('./oas/authorizationCookie')

const EXIT_TIMEOUT = 1000
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

class Server {
  constructor(config) {
    this.config = config
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

  async setPermissions() {
    if (!this.config.permissions) {
      if (redis) {
        let permissionsJson

        while(!permissionsJson) {
          permissionsJson = await redis.getAsync('permissions')

          if (!permissionsJson) {
            log.info('[config] Waiting for permissions to be defined in redis...')
            await wait(2000)

          } else {
            log.info('[config] Got authentication permissions')
            this.config.permissions = JSON.parse(permissionsJson)

          }
        }

        const permissionsListener = redis.duplicate()
        permissionsListener.on('ready', () => {
          permissionsListener.subscribe('permissions')
          log.info('[config] Listening redis for permissions update')

          permissionsListener.on('message', (channel, permissionsJson) => {
            log.info('[config] Permissions are updated')
            this.config.permissions = JSON.parse(permissionsJson)
          })
        })
      }
    }
  }

  createServerMiddleware(server) {
    server.use(responseTime())
    server.use(helmet.noCache())
    server.use(helmet())
    server.use(cookieParser())

    const limit = _.get(this.config, 'server.bodySizeLimit', '2mb')
    server.use(bodyParser.json({ limit }))

    const options     = _.get(this.config, 'server.cors', {})
    const instanceUri = _.get(this.config, 'instance.uri')
    server.use(middleware.cors(instanceUri, options))

    server.use(useragent.express())
    server.use(authorizationCookie)
    server.use(createRequestNamespace)
  }

  async createServer() {
    const host = _.get(this.config, 'server.host')
    const port = _.get(this.config, 'server.port')

    // TODO: Check if these should be kept in config.
    const securityHandlers = _.get(this.config, 'service.securityHandlers', {})
    const swaggerHandler   = _.get(this.config, 'service.swaggerHandler', null)

    if (!securityHandlers) {
      log.warn('`service.securityHandlers` hash is not defined.')
    }

    const server = express()

    // TODO: These might not be required anymore, need to double check.
    server.set('config',           this.config)
    server.set('port',             port)
    server.set('securityHandlers', securityHandlers)
    server.set('swaggerHandler',   swaggerHandler)

    this.createServerMiddleware(server)

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

  async readSecrets() {
    const secrets = this.config.secrets
    if (!secrets) {
      return
    }

    const kmsKey = this.config.kms.KeyId
    if (kmsKey) {
      const table   = 'secrets'
      const region  = this.config.kms.Region
      const options = { table, kmsKey, awsOpts: { region } }

      const profile = _.get(this.config, 'kms.Credentials.profile')
      if (profile) {
        options.awsOpts.credentials =
          new AWS.SharedIniFileCredentials({ profile })
      }

      const credstash = new Credstash(options)

      return Promise.all(secrets.map(async (secret) => {
        const { name, context, target } = secret
        const query = { name, context }
        const value = await credstash.getSecret(query)

        _.set(this.config, target, value)
      }))
    }
  }

  async buildApiClient() {
    this.apiClient = new Client(this.config)
    await this.apiClient.initialize()

    global.Services = this.apiClient
  }

  initialize() {
    return this.logger()
      .then(() => this.readSecrets())
      .then(() => this.buildApiClient())
      .then(() => this.connectDatabases())
      .then(() => this.setPermissions())
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
        console.log(error)
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
