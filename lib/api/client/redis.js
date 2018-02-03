'use strict'

const _                = require('lodash')
const mock             = require('./mock')
const db               = require('../../db')
const RequestNamespace = require('../../requestNamespace')

// TODO: This is not used.
const IS_TEST_ENVIRONMENT = [ 'test', 'gitlab' ].indexOf(process.env.NODE_ENV) > -1

// TODO: This should be named RedisClient.
class Redis {
  constructor() {
    this.buffer         = {}
    this.requestCounter = 0
  }

  // TODO: This method doesn't make sence, config should be passed to the
  //       constructor.
  initialize(config) {
    this.config = config
    return this
  }

  async registerService(serviceName, spec) {
    const queues     = []
    const instanceId = this.config.server.instanceId

    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        const operationId = operation.operationId
        if (operationId) {
          const qname = this._getResponseQueueName(operationId, instanceId)
          queues.push(qname)
        }
      })
    })

    const client   = await db.redis.duplicateClient(redis)
    const callback = this._response.bind(this)
    db.redis.listenQueueBasedList({ client, queues, callback })
  }

  // TODO: Public interfaces should be in the end.
  send({ operationId, parameters, serviceName }) {
    log.info(`[redis client]: ${serviceName}.${operationId}`, parameters)

    const requestNamespace = new RequestNamespace()
    const { authenticationToken, requestId, sourceOperationId } =
      requestNamespace.getAll()
    const instanceId       = this.config.server.instanceId
    // TODO: This is not unique request id, but just request id.
    const uniqueRequestId  = this._getUniqueRequestId(requestId)
    const qname            = this._getRequestQueueName(operationId)

    // TODO: Should be separate method
    return new Promise((resolve, reject) => {
      const headers = {
        'x-authentication-token': authenticationToken,
        'x-request-id':           requestId,
        'x-source-operation-id':  sourceOperationId,
        'x-instance-id':          instanceId,
        'x-unique-request-id':    uniqueRequestId
      }

      this._addCallbackToBuffer({ uniqueRequestId, resolve, reject })
      this._addToQueue({ serviceName, qname, parameters, headers })
    })
  }

  // TODO: Rename to _pushCallback
  _addCallbackToBuffer({ uniqueRequestId, resolve, reject }) {
    this.buffer[uniqueRequestId] = { resolve, reject }
  }

  // TODO: Rename to _pullCallback
  _withdrawCallbackFromBuffer(uniqueRequestId) {
    const object = this.buffer[uniqueRequestId]
    delete this.buffer[uniqueRequestId]
    return object
  }

  _response(msg) {
    const response = JSON.parse(msg[1])
    const { headers, body, statusCode } = response
    const object   = (body ? JSON.parse(body) : body)

    const uniqueRequestId = headers['x-unique-request-id']
    const handlers        = this._withdrawCallbackFromBuffer(uniqueRequestId)

    if (!handlers) {
      return log.error(`Unidentified response with ID: ${uniqueRequestId}`)
    }

    const { resolve, reject } = handlers

    if (statusCode >= 400) {
      log.error('[redis client] Error: ', object)
      return reject(object)
    }

    return resolve({ obj: object })
  }

  _addToQueue({ serviceName, qname, parameters, headers }) {
    const object = { parameters, headers }
    const json   = JSON.stringify(object)

    return redis.lpushAsync(qname, json)
  }

  _getRequestQueueName(operationId) {
    return `requests:${operationId}`
  }

  _getResponseQueueName(operationId, instanceId) {
    return `responses:${operationId}:${instanceId}`
  }

  _getUniqueRequestId(requestId) {
    return `${requestId}:${++this.requestCounter}`
  }
}

const redisClient = new Redis()

exports = module.exports = redisClient
exports.Redis = Redis
