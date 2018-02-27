'use strict'

const _ = require('lodash')

const RequestNamespace = require('../../requestNamespace')

class Message {
  constructor(client, object, headers={}) {
    const requestNamespace = new RequestNamespace()

    const { authenticationToken, sourceRequestId, requestId, sourceOperationId, instanceId } = 
      requestNamespace.getAll()

    headers = _.assign(
      headers,
      { authenticationToken, sourceRequestId, requestId, sourceOperationId, instanceId }
    )

    this.client = client
    this.object = { object, headers }
    this.json   = JSON.stringify(this.object)
  }

  publish(address) {
    log.info('[msg] Publish to', address, this.object.object)

    return this.client.publishAsync(address, this.json)
      .catch(error => log.error('[msg] Message publish error:', error))
  }

  send(qname) {
    log.info('[msg] Send to', qname, this.object.object)

    return this.client.lpushAsync(qname, this.json)
      .catch(error => log.error('[msg] Message send error:', error))
  }
}

module.exports = Message
