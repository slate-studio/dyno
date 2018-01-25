'use strict'

const _  = require('lodash')

class RedisTransport {
  constructor() {
    this.buffer               = {}
    this.registerOfOperations = []
  }

  sendRequest({ operationId, parameters, callback }) {
    const message   = Message(parameters)
    const queueName = this._getRequestQueueName(operationId)

    const { requestId, instanceId } = message.object.headers
    const params = {
      operationId,
      requestId,
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

  async _registerOperationIdForListenResponse({ operationId, requestId, instanceId, callback }) {

    this.buffer[requestId] = callback

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
    const { requestId } = msg.object
    const callback = this.buffer[requestId]

    delete this.buffer[requestId]

    return callback(msg)
  }

  _getRequestQueueName(operationId) {
    return `requests:${operationId}`
  }

  _getResponseQueueName(operationId, instanceId) {
    return `responses:${operationId}:${instanceId}`
  }
}

const redisTransport = new RedisTransport()

exports = module.exports = redisTransport
exports.RedisTransport = RedisTransport
