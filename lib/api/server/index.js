'use strict'

const _ = require('lodash')

const express      = require('express')
const cors         = require('cors')
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

const EXIT_TIMEOUT = 500
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

class Server {
  constructor(config) {
    this.config = config
  }

  logger() {
    return logger(this.config)
  }

  async readSecrets() {
    log.debug('> readSecrets')

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
    log.debug('> buildApiClient')

    this.apiClient = new Client(this.config)
    await this.apiClient.initialize()

    global.Services = this.apiClient
  }

  async connectDatabases() {
    log.debug('> connectDatabases')

    const mongodbConfig = _.get(this.config, 'mongodb')
    const redisConfig   = _.get(this.config, 'redis')

    if (mongodbConfig) {
      const { globals } = await db.mongodb(mongodbConfig)
      global.Model  = globals.Model
      global.Schema = globals.Schema
    }

    if (redisConfig) {
      global.redis = await db.redis(redisConfig)
      const { host, port } = redisConfig
      log.info('[database] Redis connected to', { host, port })
    }
  }

  async setPermissions() {
    log.debug('> setPermissions')

    if (!this.config.permissions) {
      if (redis) {
        let permissionsJson

        while(!permissionsJson) {
          permissionsJson = await redis.getAsync('permissions')

          if (!permissionsJson) {
            log.info('[redis] Waiting for permissions to be defined in redis...')
            await wait(2000)

          } else {
            log.info('[redis] Got authentication permissions')
            this.config.permissions = JSON.parse(permissionsJson)
          }
        }
      }
    }
  }

  async createServer() {
    log.debug('> createServer')

    this.server = express()
    this.server.set('config', this.config)
  }

  async createServerMiddleware() {
    log.debug('> createServerMiddleware')

    this.server.use(responseTime())
    this.server.use(helmet.noCache())
    this.server.use(helmet())
    this.server.use(cookieParser())

    const limit = _.get(this.config, 'server.bodySizeLimit', '2mb')
    this.server.use(bodyParser.json({ limit }))

    const options = _.get(this.config, 'server.cors', {})
    this.server.use(cors(options))

    this.server.use(useragent.express())
    this.server.use(authorizationCookie)
    this.server.use(createRequestNamespace)

    this.server.use('/', health)
  }

  createServerOasMiddleware() {
    log.debug('> createServerOasMiddleware')

    return new Promise(resolve => {
      oas(this.server, () => {

        // TODO: Check this error handler on when it gets called.
        this.server.use((error, req, res, next) => {
          log.error(error)
          res.status(500).json(error)
        })

        resolve()
      })
    })
  }

  async initialize() {
    await this.logger()
    await this.readSecrets()
    await this.buildApiClient()
    await this.connectDatabases()
    await this.setPermissions()
    await this.createServer()
    await this.createServerMiddleware()
    await this.createServerOasMiddleware()
  }

  async listen() {
    try {
      await this.initialize()

    } catch (error) {
      log.fatal('[api] Initialization error:', error)

      setTimeout(() => process.exit(1), EXIT_TIMEOUT)
      return
    }

    const port = this.config.server.port

    log.info(`[api] Listening on port ${port}`)
    return new Promise(resolve => this.server.listen(port, () => resolve(this.server)))
  }
}

exports = module.exports = config => {
  const server = new Server(config)
  return server.listen()
}

exports.Server = Server
