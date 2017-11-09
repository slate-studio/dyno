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
    const namespace           = { requestId }

    // TODO: Implement support for authentication method.

    if (!authenticationToken) {
      log.warn('[msg] AuthenticationToken header is not defined, skiping message')
      return
    }

    _.extend(namespace, getRequestNamespace(authenticationToken))

    return new Promise(resolve => {
      this.requestNamespace = new RequestNamespace(namespace)
      this.requestNamespace.save([], async() => {
        await callback(this)
        resolve()
      })
    })
  }
}

module.exports = Msg
