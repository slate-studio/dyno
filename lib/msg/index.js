'use strict'

const _ = require('lodash')

const redis = require('./redis')

const connectRedis = require('../db/redis').connect

class ConnectMsg {
  constructor(config) {
    this.config = config
  }

  connect() {
    let config

    config = _.get(this.config, 'redis')
    if (config) {
      return this.setupRedis(config)
    }

    log.warn('[msg] No configuration defined, messaging is not supported')
    this.globals = {}
    return Promise.resolve(this)
  }

  setupRedis(config) {
    return connectRedis(config)
      .then(client => {
        const { host, port } = config
        log.info('[msg] Redis connected to', { host, port })

        const Message  = object => new redis.Message(client, object)
        const Listener = handlers => new redis.Listener(client, handlers)
        this.globals = { Message, Listener, Msg: redis.Msg }

        return this
      })
  }
}

exports = module.exports = config => {
  if (!global['log']) {
    throw new Error('[msg] Logger has to be initialized, `global.log` is not defined')
  }

  const msg = new ConnectMsg(config)

  return msg.connect()
}

exports.ConnectMsg = ConnectMsg
