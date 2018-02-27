'use strict'

const _                = require('lodash')
const db               = require('../../db')
const helpers          = require('../helpers')
const RequestNamespace = require('../../requestNamespace')

class RedisClient {
  constructor(config) {
    this.config = config
    this.buffer = {}
  }

  _pushCallback({ requestId, resolve, reject }) {
    this.buffer[requestId] = { resolve, reject }
  }

  _pullCallback(requestId) {
    const object = this.buffer[requestId]
    delete this.buffer[requestId]
    return object
  }

  _response(msg) {
    const response = JSON.parse(msg[1])
    const { headers, body, statusCode } = response

    const requestId = headers['x-request-id']
    const handlers  = this._pullCallback(requestId)

    if (!handlers) {
      return log.error(`Unidentified response with ID: ${requestId}`)
    }

    const { resolve, reject } = handlers

    if (statusCode >= 400) {
      log.error('[redis client] Error: ', body)
      const error = this._extendError(response)
      return reject(body)
    }

    return resolve({ obj: body, headers, body, statusCode })
  }

  _extendError(response) {
    let error = response.body
    if (_.isEmpty(error)) {
      error = new Error(`Error: ${response.statusCode}`)
    }

    error.statusCode = response.statusCode

    return error
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

  async send({ operationId, parameters, serviceName }) {
    log.info(`[redis client]: ${serviceName}.${operationId}`, parameters)

    const requestNamespace = new RequestNamespace()
    const { authenticationToken, sourceRequestId, sourceOperationId } =
      requestNamespace.getAll()
    const instanceId = helpers.getInstanceId()
    const requestId  = await this.getRequestId(sourceRequestId)
    const qname      = this.getRequestQueueName(operationId)

    // TODO: Should be separate method
    return new Promise((resolve, reject) => {
      const headers = {
        'x-authentication-token': authenticationToken,
        'x-source-request-id':    sourceRequestId,
        'x-request-id':           requestId,
        'x-source-operation-id':  sourceOperationId,
        'x-instance-id':          instanceId
      }

      this._pushCallback({ requestId, resolve, reject })
      this._addToQueue({ serviceName, qname, parameters, headers })
    })
  }

  getRequestQueueName(operationId) {
    let prefix = _.get(this.config, 'server.redis.queueNamePrefix', '')
    prefix = prefix.replace(':', '_')
    return `${prefix}requests:${operationId}`
  }

  getResponseQueueName(operationId) {
    const instanceId = helpers.getInstanceId()
    let prefix       = _.get(this.config, 'server.redis.queueNamePrefix', '')
    prefix           = prefix.replace(':', '_')

    return `${prefix}responses:${operationId}:${instanceId}`
  }

  async getRequestId(sourceRequestId) {
    const requestCounter = await helpers.generateRequestCounter()
    return helpers.buildRequestId(sourceRequestId, requestCounter)
  }
}

exports = module.exports = RedisClient
