'use strict'

const _             = require('lodash')
const fs            = require('fs')
const yaml          = require('js-yaml')
const faker         = require('faker')
const nock          = require('nock')
const statuses      = require('statuses')
const db            = require('../../db')
const HttpClient    = require('./http')
const RedisClient   = require('./redis')
const SwaggerClient = require('swagger-client')

const services        = {}
const dependenciesMap = {}

const rootPath      = process.cwd()
const yamlPath      = `${rootPath}/src/api/swagger.yaml`
const yml           = fs.readFileSync(yamlPath, 'utf8')
const spec          = yaml.safeLoad(yml)

if (spec.paths) {
  _.forEach(spec.paths, methods => {
    _.forEach(methods, operation => {
      if (operation.operationId) {
        const dependency = operation['x-dependency-operation-ids'] || []
        dependenciesMap[operation.operationId] = dependency
      }
    })
  })
}

const HTTP_SUCCESS_RESPONSES = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content'
}

class RedisNock {

  constructor() {
    this.clients         = {}
    this.specs           = {}
    this.requestHandlers = {}
  }

  initializeService(serviceName, client, spec) {
    this.clients[serviceName] = client
    this.specs[serviceName]   = spec

    return this._listeningRequests(serviceName)
  }

  setRequestHandler(operationId, parameters, response) {
    const handlerName = this._buildRequestHandlerName(operationId, parameters)
    
    if (!this.requestHandlers[handlerName]) {
      this.requestHandlers[handlerName] = []
    }

    const length = this.requestHandlers[handlerName].push(response)

    const mock = {
      done: () => {
        const index = (length - 1)
        if (this.requestHandlers[handlerName][index]) {
          throw new Error('Mock not yet executed')
        }
      }
    }

    return mock
  }

  pullRequestHandler(operationId, parameters) {
    const handlerName  = this._buildRequestHandlerName(operationId, parameters)
    const responsesMap = this.requestHandlers[handlerName]

    let response

    for (let i in responsesMap) {
      if (responsesMap[i]) {
        response = responsesMap[i]
        delete responsesMap[i]
        break
      }
    }

    if (!response) {
      this.requestHandlers[handlerName] = []
    }

    return response
  }

  _buildRequestHandlerName(operationId, parameters = {}) {
    let handlerName = operationId

    const keys = _.keys(parameters)
    keys.sort()

    keys.forEach(name => {
      const value = parameters[name]
      if (_.isObject(value) || _.isArray(value)) {
        handlerName += `${name}={};`
      } else {
        handlerName += `${name}=${value};`
      }
    })

    return handlerName
  }

  async _listeningRequests(serviceName) {
    const spec   = this.specs[serviceName]
    const client = this.clients[serviceName]
    const queues = []

    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        const operationId = operation.operationId
        if (operationId) {
          const qname = client.getRequestQueueName(operationId)
          queues.push(qname)
        }
      })
    })

    const redisClient   = await db.redis.duplicateClient(redis)
    const callback = this._requestHandler.bind(this, serviceName)
    db.redis.listenQueueBasedList({ client: redisClient, queues, callback })
  }

  _requestHandler(serviceName, msg) {
    const [ qname, message ]      = msg
    const source                  = JSON.parse(message)
    const operationId             = qname.split(':')[1]
    const { parameters, headers } = source
    const instanceId              = headers['x-instance-id']

    const client      = this.clients[serviceName]
    const response    = this.pullRequestHandler(operationId, parameters)
    const queueName   = client.getResponseQueueName(operationId, instanceId)

    let body
    let statusCode

    if (response) {
      body       = response.object || null
      statusCode = response.status
    } else {
      const error = new Error(`Mock not found for ${operationId}`)
      body        = _.pick(error, [ 'name', 'message', 'stack', 'errors' ])
      statusCode  = 500
    }
    
    const statusMessage = statuses[statusCode] || String(statusCode)
    const object        = { headers, body, statusCode, statusMessage }
    
    this._send(queueName, object)
  }

  _send(queueName, object) {
    const json = JSON.stringify(object)
    redis.lpushAsync(queueName, json)
  }
}

class Mock {
  constructor(sourceOperationId) {
    this.sourceOperationId = sourceOperationId
  }

  setMock(destination, params, response = {}) {

    // TODO: buildRequest requires all required parameters to be present, that
    //       means for update request we need to specify empty {} body param.

    const [ serviceName, operationId ] = destination.split('.')
    const { client, spec } = services[serviceName]

    if (!spec) {
      log.debug(`Service '${serviceName}' doesn't exists`)
      return
    }

    const dependencies = dependenciesMap[this.sourceOperationId]
    if (this.sourceOperationId && !_.includes(dependencies, operationId)) {
      const message = `OperationId '${operationId}' doesen't exists in the '${this.sourceOperationId}' dependencies`
      throw new Error(message)
    }

    switch(true) {
      case client instanceof HttpClient:
        return this._setHttpMock(operationId, params, response, spec)
        break

      case client instanceof RedisClient:
        return this._setRedisMock(operationId, params, response)
        break
    }
  }

  _setHttpMock(operationId, params, response, spec) {
    const host    = `http://${spec.host}`
    const request = SwaggerClient.buildRequest({
      spec:        spec,
      operationId: operationId,
      parameters:  params
    })

    const method = request.method.toLowerCase()
    const path   = _.replace(request.url, host, '')

    if (_.isEmpty(response)) {
      response = this._defaultSuccessResponseFor(spec, operationId)
    }

    return nock(host)[method](path).reply(response.status, response.object)
  }

  _setRedisMock(operationId, params, response) {
    return redisNock.setRequestHandler(operationId, params, response)
  }

  _defaultSuccessResponseFor(spec, operationId) {
    const operation = this._findOperation(spec, operationId)
    const responses = operation.responses
    const status    = this._successResponseStatus(responses)
    const schema    = responses[status].definition.properties
    const object    = this._fakeObject(schema)

    return { status: status, object: object }
  }

  _successResponseStatus(responses) {
    const successCodes = _.keys(HTTP_SUCCESS_RESPONSES)
    const codes = _.keys(responses)

    return _.intersection(successCodes, codes)[0] || 200
  }

  _findOperation(spec, operationId) {
    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        if (operation.operationId == operationId) {
          return operation
        }
      })
    })

    return
  }

  // TODO: Get rid of it, not useful.
  _fakeObject(schema) {
    const result = {}

    _.forEach(schema, (def, name) => {
      let value

      if (def.hasOwnProperty('default')) {
        value = def.default

      } else if (def.hasOwnProperty('format')) {
        switch (def.format) {
          case 'uuid':
            value = faker.random.uuid()
            break

          case 'date-time':
          case 'date':
            value = faker.date.recent()
            break

          default:
            value = faker.lorem.word()
            break
        }
      } else {
        switch (def.type) {
          case 'integer':
            value = faker.random.number()
            break

          case 'boolean':
            value = true
            break

          case 'array':
            value = []
            break

          default:
            value = faker.lorem.word()
            break
        }
      }

      result[name] = value
    })

    return result
  }
}

const redisNock = new RedisNock()

exports = module.exports = (serviceName, client, spec) => {
  services[serviceName] = { client, spec }

  if (client instanceof RedisClient) {
    return redisNock.initializeService(serviceName, client, spec)
  }
  return Promise.resolve()
}
exports.Mock = Mock