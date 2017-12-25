'use strict'

const _ = require('lodash')

const RequestNamespace    = require('../../requestNamespace')
const getRequestNamespace = require('../../getRequestNamespace')

class Msg {
  constructor(channel, json) {
    this.channel = channel
    const source = JSON.parse(json)

    this.object  = source.object
    this.headers = source.headers
  }

  exec(callback) {
    const requestId           = _.get(this.headers, 'requestId', null)
    const authenticationToken = _.get(this.headers, 'authenticationToken', null)
    const sourceOperationId   = _.get(this.headers, 'sourceOperationId', null)
    const namespace           = { requestId, sourceOperationId }

    // TODO: Implement support for authentication method.
    if (!authenticationToken) {
      log.warn('[msg] AuthenticationToken header is not defined, skiping message')
      return
    }

    _.extend(namespace, getRequestNamespace(authenticationToken))

    this.requestNamespace = new RequestNamespace(namespace)
    this.requestNamespace.save([], async() => {
      log.info(`[msg] Got message from ${this.channel}`)

      try {
        await callback(this)
        log.info('[msg] Message succesfully handled')

      } catch (error) {
        log.error('[msg] Message handler error:', error)

      }
    })
  }
}

module.exports = Msg
