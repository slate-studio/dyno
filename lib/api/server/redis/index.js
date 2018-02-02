'use strict'

const _          = require('lodash')
const rootPath   = process.cwd()
const db         = require('../../../db')
const Meddleware = require('./meddleware')
const Req        = require('./req')
const Res        = require('./res')

class App {
  constructor() {
    this.settings = {}
  }

  set(key, value) {
    this.settings[key] = value
    return this
  }

  get(key) {
    return this.settings[key]
  }
}

class Redis {

  constructor(config) {
    this.app      = new App()
    this.config   = config
    this.jsonPath = `${rootPath}/src/api/swagger.json`
    this.yamlPath = `${rootPath}/src/api/swagger.yaml`

    this.detailsOfOperations = {}
    this.responseHeaders = [
      'x-request-id',
      'x-unique-request-id',
      'x-authentication-token',
      'x-source-operation-id',
    ]
  }

  async initialize() {
    const port           = _.get(this.config, 'server.port')
    const Authentication = _.get(this.config, 'service.Authentication', null)
    const swaggerHandler = _.get(this.config, 'service.swaggerHandler', null)

    if (!Authentication) {
      log.warn('`service.Authentication` class is not defined.')
    }

    this.app.set('config', this.config)
    this.app.set('port',   port)
    this.app.set('instanceId', this.config.server.instanceId)
    this.app.set('Authentication', Authentication)
    this.app.set('swaggerHandler', swaggerHandler)

    this.middleware = new Meddleware(this.yamlPath)
    await this.middleware.initialize()

    await this._listeningRequests()
  }

  async _listeningRequests() {
    const queues = []
    const spec   = require(this.jsonPath)

    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        const operationId = operation.operationId
        if (operationId) {
          this.detailsOfOperations[operationId] = { path, method }

          const qname = this._getRequestQueueName(operationId)
          queues.push(qname)
        }
      })
    })

    const client   = await db.redis.duplicateClient(redis)
    const callback = this._exec.bind(this)
    db.redis.listenQueueBasedList({ client, queues, callback })
  }

  async _exec(msg) {
    const [ qname, message ]  = msg
    const source              = JSON.parse(message)
    const operationId         = this._parseQname(qname)[1]
    const details             = this.detailsOfOperations[operationId]
    const { parameters, headers } = source

    if (!details) {
      const message = 'Received a request for a nonexistent operation'
      log.error(`[redis server] Error: ${message}: `, operationId)
      return this._sendOperationNotFoundResponse(operationId, headers)
    }

    const operation = this.middleware.api.getOperation(details.path, details.method)
    const params    = { operation, parameters, headers }
    const request   = new Req(params)
    const response  = new Res()

    request.res  = response
    request.app  = this.app

    response.req = request
    response.app = this.app

    this.responseHeaders.forEach(name => {
      const value = request.get(name)
      response.set(name, value)
    })

    response.once('finish', () => this._sendResponse(request, response))

    this.middleware.execRequestMiddleware(request, response)
  }

  _sendResponse(request, response) {
    const { operationId } = request.swagger.operation

    let instanceId
    if (request.requestNamespace) {
      instanceId = request.requestNamespace.get('instanceId')
    } else {
      instanceId = request.get('x-instance-id')
    }

    const qname = this._getResponseQueueName(operationId, instanceId)
    const data  = response.getResponseData()

    return redis.lpushAsync(qname, data)
  }

  _sendOperationNotFoundResponse(operationId, headers) {
    const instanceId = headers['x-instance-id']
    if (instanceId) {
      const response = new Res()
      const qname    = this._getResponseQueueName(operationId, instanceId)

      response.set('x-instance-id', instanceId)
      response.status(404)

      const data  = response.getResponseData()
      return redis.lpushAsync(qname, data)
    }
  }

  _getRequestQueueName(operationId) {
    return `requests:${operationId}`
  }

  _getResponseQueueName(operationId, instanceId) {
    return `responses:${operationId}:${instanceId}`
  }

  _parseQname(qname) {
    return qname.split(':')
  }
}

exports = module.exports = Redis
