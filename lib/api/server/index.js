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
const responseTime = require('response-time')
const helmet       = require('helmet')
const useragent    = require('express-useragent')
const errorHandler = require('./errorHandler')
const Client       = require('../client')
const AWS          = require('aws-sdk')
const Credstash    = require('nodecredstash')

const { createRequestNamespace } = require('./oas/requestNamespace')
const authorizationCookie        = require('./oas/authorizationCookie')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

class Server {
  constructor(config) {
    this.config = config
  }

  logger() {
    return logger(this.config)
  }

  async updateSecrets() {
    if (!this.config.secrets   ||
        !this.config.kms.KeyId ||
        !this.config.instance.name) {
      log.debug('> updateSecrets [missing configuration]')
      return
    }

    const table = `${this.config.instance.name}_secrets`
    log.debug(`> updateSecrets [${table}]`)

    const kmsKey  = this.config.kms.KeyId
    const region  = this.config.kms.Region
    const options = { table, kmsKey, awsOpts: { region } }
    const profile = _.get(this.config, 'kms.Credentials.profile')

    if (profile) {
      const credentials = new AWS.SharedIniFileCredentials({ profile })
      options.awsOpts.credentials = credentials
    }

    const { secrets } = this.config
    const credstash   = new Credstash(options)

    for (const name in secrets) {
      const { target, context } = secrets[name]
      context.uri = this.config.instance.uri
      const value = await credstash.getSecret({ name, context })

      if (value) {
        _.set(this.config, target, value)
        log.debug(`  + ${target}`)
      }
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
      log.info('[redis] Connected to', { host, port })
    }
  }

  async setPermissions() {
    log.debug('> setPermissions')

    if (!this.config.permissions) {
      if (redis) {
        let permissionsJson

        while (!permissionsJson) {
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

  async createServer() {
    log.debug('> createServer')

    this.http = this.server = express()
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

    const options     = _.get(this.config, 'server.cors', {})
    const instanceUri = _.get(this.config, 'instance.uri')
    this.server.use(middleware.cors(instanceUri, options))

    this.server.use(useragent.express())
    this.server.use(authorizationCookie)
    this.server.use(createRequestNamespace)

    this.server.use('/', health)
  }

  createServerOasMiddleware() {
    log.debug('> createServerOasMiddleware')

    return new Promise(resolve => {
      oas(this.server, () => {
        this.server.use((error, req, res, next) => errorHandler(req, res, error))
        resolve()
      })
    })
  }

  async initialize() {
    await this.logger()
    await this.updateSecrets()
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
      const exitTimeout = _.get(this.config, 'exitTimeout', 1000)
      const msg = `[api] Initialization error, application shutdown in ${exitTimeout}ms`

      if (global.log) {
        log.fatal(error, msg)

      } else {
        console.error(error)
        console.error(msg)

      }

      return setTimeout(() => process.exit(1), exitTimeout)
    }

    const port = this.config.server.port

    log.info(`[api] Listening on port ${port}`)
    return new Promise(resolve => this.server.listen(port, () => resolve(this)))
  }
}

exports = module.exports = config => {
  const server = new Server(config)
  return server.listen()
}

exports.Server = Server
