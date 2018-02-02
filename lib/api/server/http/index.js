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

    const server = express()

    if (!Authentication) {
      log.warn('`service.Authentication` class is not defined.')
    }

    // await this.setPublicKey(server)

    server.set('config', this.config)
    server.set('port',   port)
    server.set('instanceId', this.config.server.instanceId)
    server.set('Authentication', Authentication)
    server.set('swaggerHandler', swaggerHandler)

    server.use(bodyParser.json( { limit: bodySizeLimit } ))
    server.use(cors(corsConfig))
    server.use(responseTime())
    server.use(createRequestNamespace)
    server.use('/', health)
    server.use(timeout(requestTimeout))

    return new Promise(resolve => {
      this._oasInitialize(server, { host, port }, () => {
        server.use((error, req, res, next) => {
          log.error(error)

          const response = _.pick(error, [ 'name', 'message', 'stack' ])
          res.status(error.statusCode || 500).json(response)
        })

        resolve(server)
      })
    })
  }

  _oasInitialize(server, { host, port }, callback) {
    const isEnabled = fs.existsSync(this.yamlPath)

    if (!isEnabled) {
      log.info(`[api] No specification found at ${this.yamlPath}`)
      callback()
    }

    const swaggerHandler = server.get('swaggerHandler')
    server.get('/swagger', swaggerHandler || this._defaultSwaggerHandler)

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

      middleware.register(server)
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