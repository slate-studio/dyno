'use strict'

const _                = require('lodash')
const db               = require('../../db')
const RequestNamespace = require('../../requestNamespace')

class RedisClient {
  constructor(config) {
    this.config         = config
    this.buffer         = {}
    this.requestCounter = 0
  }

  _pushCallback({ uniqueRequestId, resolve, reject }) {
    this.buffer[uniqueRequestId] = { resolve, reject }
  }

  _pullCallback(uniqueRequestId) {
    const object = this.buffer[uniqueRequestId]
    delete this.buffer[uniqueRequestId]
    return object
  }

  _response(msg) {
    const response = JSON.parse(msg[1])
    const { headers, body, statusCode } = response

    const uniqueRequestId = headers['x-unique-request-id']
    const handlers        = this._pullCallback(uniqueRequestId)

    if (!handlers) {
      return log.error(`Unidentified response with ID: ${uniqueRequestId}`)
    }

    const { resolve, reject } = handlers

    if (statusCode >= 400) {
      log.error('[redis client] Error: ', body)
      return reject(body)
    }

    return resolve({ obj: body, headers, body, statusCode })
  }

  _addToQueue({ serviceName, qname, parameters, headers }) {
    const object = { parameters, headers }
    const json   = JSON.stringify(object)

    return redis.lpushAsync(qname, json)
  }

  async registerService(serviceName, spec) {
    const queues     = []

    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        const operationId = operation.operationId
        if (operationId) {
          const qname = this.getResponseQueueName(operationId)
          queues.push(qname)
        }
      })
    })

    const client   = await db.redis.duplicateClient(redis)
    const callback = this._response.bind(this)
    db.redis.listenQueueBasedList({ client, queues, callback })
  }

  send({ operationId, parameters, serviceName }) {
    log.info(`[redis client]: ${serviceName}.${operationId}`, parameters)

    const requestNamespace = new RequestNamespace()
    const { authenticationToken, requestId, sourceOperationId } =
      requestNamespace.getAll()
    const instanceId       = this.config.server.instanceId
    // TODO: This is not unique request id, but just request id.
    const uniqueRequestId  = this.getUniqueRequestId(requestId)
    const qname            = this.getRequestQueueName(operationId)

    // TODO: Should be separate method
    return new Promise((resolve, reject) => {
      const headers = {
        'x-authentication-token': authenticationToken,
        'x-request-id':           requestId,
        'x-source-operation-id':  sourceOperationId,
        'x-instance-id':          instanceId,
        'x-unique-request-id':    uniqueRequestId
      }

      this._pushCallback({ uniqueRequestId, resolve, reject })
      this._addToQueue({ serviceName, qname, parameters, headers })
    })
  }

  getRequestQueueName(operationId) {
    let prefix = _.get(this.config, 'server.redis.queueNamePrefix', '')
    prefix = prefix.replace(':', '_')

    return `${prefix}requests:${operationId}`
  }

  getResponseQueueName(operationId) {
    const instanceId = this.getinstanceId()
    let prefix       = _.get(this.config, 'server.redis.queueNamePrefix', '')
    prefix           = prefix.replace(':', '_')

    return `${prefix}responses:${operationId}:${instanceId}`
  }

  getUniqueRequestId(requestId) {
    return `${requestId}:${++this.requestCounter}`
  }

  getinstanceId() {
    return this.config.server.instanceId
  }
}

exports = module.exports = RedisClient
