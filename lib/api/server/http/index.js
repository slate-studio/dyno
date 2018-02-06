'use strict'

const _            = require('lodash')
const fs           = require('fs')
const yaml         = require('js-yaml')
const bodyParser   = require('body-parser')
const express      = require('express')
const cors         = require('cors')
const timeout      = require('connect-timeout')
const responseTime = require('response-time')
const health       = require('./health')
const rootPath     = process.cwd()

const securityHandlers           = require('../middleware/securityHandlers')
const { createRequestNamespace } = require('../middleware/requestNamespace')

class Http {
  constructor(config) {
    this.config   = config
    this.app      = express()
    this.yamlPath = `${rootPath}/src/api/swagger.yaml`
    this.jsonPath = `${rootPath}/src/api/swagger.json`
  }

  async initialize() {
    const host           = _.get(this.config, 'server.host')
    const port           = _.get(this.config, 'server.port')
    const requestTimeout = _.get(this.config, 'server.requestTimeout', 15000)
    const bodySizeLimit  = _.get(this.config, 'server.bodySizeLimit', '10mb')
    const corsConfig     = _.get(this.config, 'server.cors', {})
    const Authentication = _.get(this.config, 'service.Authentication', null)
    const swaggerHandler = _.get(this.config, 'service.swaggerHandler', null)

    if (!Authentication) {
      log.warn('`service.Authentication` class is not defined.')
    }

    // await this.setPublicKey(server)

    this.app.set('config', this.config)
    this.app.set('port',   port)
    this.app.set('instanceId', this.config.server.instanceId)
    this.app.set('Authentication', Authentication)
    this.app.set('swaggerHandler', swaggerHandler)

    this.app.use(bodyParser.json( { limit: bodySizeLimit } ))
    this.app.use(cors(corsConfig))
    this.app.use(responseTime())
    this.app.use(createRequestNamespace)
    this.app.use('/', health)
    this.app.use(timeout(requestTimeout))

    return new Promise(resolve => {
      this._oasInitialize({ host, port }, () => {
        this.app.use((error, req, res, next) => {
          log.error(error)

          const response = _.pick(error, [ 'name', 'message', 'stack' ])
          res.status(error.statusCode || 500).json(response)
        })

        resolve(this.app)
      })
    })
  }

  set(key, value) {
    this.app.set(key, value)
    return this
  }

  get(key) {
    return this.app.get(key)
  }

  _oasInitialize({ host, port }, callback) {
    const isEnabled = fs.existsSync(this.yamlPath)

    if (!isEnabled) {
      log.info(`[api] No specification found at ${this.yamlPath}`)
      callback()
    }

    const swaggerHandler = this.app.get('swaggerHandler')
    this.app.get('/swagger', swaggerHandler || this._defaultSwaggerHandler)

    const swaggerMiddleware = require('swagger-express-mw')

    const spec       = this._buildSpec({ host, port })
    const configPath = `${__dirname}/config.yaml`
    let   config     = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'))

    config = config.swagger
    config.appRoot      = rootPath
    config.swagger      = spec
    config.fittingsDirs = [ __dirname ]

    config.securityHandlers = securityHandlers

    swaggerMiddleware.create(config, (error, middleware) => {
      if (error) {
        throw error
      }

      middleware.register(this.app)
      callback()
    })
  }

  _defaultSwaggerHandler(req, res) {
    res.sendFile(this.jsonPath)
  }

  _buildSpec({ host, port }) {
    const yml  = fs.readFileSync(this.yamlPath, 'utf8')
    const spec = yaml.safeLoad(yml)
    spec.host  = `${host}:${port}`

    const json = JSON.stringify(spec, null, '  ')
    fs.writeFileSync(this.jsonPath, json)

    return spec
  }
}

exports = module.exports = Http