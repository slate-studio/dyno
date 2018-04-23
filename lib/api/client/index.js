'use strict'

const uuidV4           = require('uuid/v4')
const mock             = require('./mock')
const jsonRequest      = require('../../jsonRequest')
const RequestNamespace = require('../../requestNamespace')
const EventEmitter     = require('events')
const SwaggerClient    = require('swagger-client')
const Pool             = require('./pool')

const IS_TEST_ENVIRONMENT = [ 'test', 'gitlab' ].indexOf(process.env.NODE_ENV) > -1

const rootPath = process.cwd()
const defaults = {
  client: {
    http: {
      maxAttempts: 10,
      retryDelay:  500
    },
    pool: {
      max_retries: 10,
      retry_delay: 500
    }
  }
}

class Client extends EventEmitter {
  constructor(config) {
    super()

    this.config   = config
    this.services = {}

    if (!config.services) {
      return
    }

    for (let key in config.services) {
      const options = config.services[key]

      const { name, host } = options
      this.services[name]  = options
      this.services[name].pool = new Pool(name, host)
    }
  }

  async _buildServiceOperations({ name, host, spec }) {
    spec = require(`${rootPath}/${spec}`)
    spec.host = host

    this.services[name].client = await SwaggerClient({ spec })

    if (IS_TEST_ENVIRONMENT) {
      mock(name, spec)
    }

    this[name] = {}

    for (let path in spec.paths) {
      const methods = spec.paths[path]

      for (let method in methods) {
        const operationId = methods[method].operationId

        if (operationId) {
          this[operationId] = async(parameters = {}, options = {}) => {
            const returnResponse = options.returnResponse || false
            delete options.returnResponse

            const params   = { operationId, parameters, options, name }
            const response = await this._execute(params)

            if (returnResponse) {
              return response
            }

            return response.object
          }

          this[name][operationId] = this[operationId]
        }
      }
    }
  }

  async _execute({ name, operationId, parameters, options }) {
    log.info(`[client] ${name}.${operationId}`, parameters)

    const swaggerClient = this.services[name].client

    const requestNamespace = new RequestNamespace()
    Object.assign(options, {
      requestId:           uuidV4(),
      sourceRequestId:     requestNamespace.get('sourceRequestId'),
      sourceOperationId:   requestNamespace.get('sourceOperationId'),
      authenticationToken: requestNamespace.get('authenticationToken'),
      facilityScope:       requestNamespace.get('facilityScope')
    })

    const requestInterceptor = req => this._requestInterceptor(req, options, name)

    const params = {
      http: jsonRequest,
      operationId,
      parameters,
      requestInterceptor
    }

    return swaggerClient.execute(params)
  }

  _requestInterceptor(req, options, name) {
    if (options.authenticationToken) {
      req.headers['authorization'] = options.authenticationToken
      req.headers['scope']         = options.facilityScope
    }

    if (options.requestId) {
      req.headers['x-request-id'] = options.requestId
    }

    if (options.sourceRequestId) {
      req.headers['x-source-request-id'] = options.sourceRequestId
    }

    if (options.sourceOperationId) {
      req.headers['x-source-operation-id'] = options.sourceOperationId
    }

    const clientOptions = this.config.client || defaults.client

    req.maxAttempts = clientOptions.http.maxAttempts
    req.retryDelay  = clientOptions.http.retryDelay
    req.client      = this.services[name].pool
  }

  async _initializePools() {
    const clientOptions = this.config.client || defaults.client

    log.debug('[client] Pool configuration:', clientOptions.pool)

    for (const name in this.services) {
      await this.services[name].pool.initialize(clientOptions.pool)
    }
  }

  async _buildOperations() {
    for (const name in this.services) {
      await this._buildServiceOperations(this.services[name])
    }
  }

  async initialize() {
    await this._initializePools()
    await this._buildOperations()
  }
}

module.exports = Client
