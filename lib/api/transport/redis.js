'use strict'

const _  = require('lodash')

const RequestNamespace = require('../../requestNamespace')

class RedisTransport {
  constructor() {
    this.buffer               = {}
    this.registerOfOperations = []
    this.requestCounter       = 0
  }

  sendRequest({ operationId, parameters, callback }) {
    const requestNamespace          = new RequestNamespace()
    const { requestId, instanceId } = requestNamespace.getAll()
    const uniqueRequestId           = this._getUniqueRequestId(requestId)
    const queueName                 = this._getRequestQueueName(operationId)
    const message                   = Message(parameters, { uniqueRequestId })

    const params = {
      operationId,
      uniqueRequestId,
      instanceId,
      callback
    }

    this._registerOperationIdForListenResponse(params)

    message.send(queueName)
  }

  listenRequests() {
    // Will be used by the server
  }

  sendResponse() {
    // Will be used by the server
  }

  async _registerOperationIdForListenResponse({ operationId, uniqueRequestId, instanceId, callback }) {

    this.buffer[uniqueRequestId] = callback

    if (!_.includes(this.registerOfOperations, operationId)) {
      this.registerOfOperations.push(operationId)
      const queueName = this._getResponseQueueName(operationId, instanceId)

      const handlerts = {}
      handlerts[queueName] = msg => this._response(msg)

      const listener = Listener(handlerts)
      listener.listen()
    }
  }

  _response(msg) {
    const { uniqueRequestId } = msg.object
    const callback = this.buffer[uniqueRequestId]

    if (!callback) {
      throw new Error(`Unidentified response with ID: ${uniqueRequestId}`)
    }

    delete this.buffer[uniqueRequestId]

    return callback(msg)
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

const redisTransport = new RedisTransport()

exports = module.exports = redisTransport
exports.RedisTransport = RedisTransport
