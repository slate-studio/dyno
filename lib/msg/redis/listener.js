'use strict'

const _ = require('lodash')
const Msg = require('./msg')

const BRPOP_DELAY_IN_SECONDS = 1

class Listener {
  constructor(client, handlers) {
    this.client   = client
    this.queues   = []
    this.topics   = []
    this.handlers = handlers

    _.forEach(handlers, (handler, name) => {
      const isTopic = _.includes(name, '.')

      if (isTopic) {
        this.topics.push(name)

      } else {
        this.queues.push(name)

      }
    })
  }

  _duplicateClient() {
    const client = this.client.duplicate()
    return new Promise(resolve => {
      client.on('error', error => log.error('[msg] Error:', error))
      client.on('ready', () => resolve(client))
    })
  }

  _listenTopics() {
    if (_.isEmpty(this.topics)) {
      return
    }

    return this._duplicateClient()
      .then(client => {
        client.on('message', async (channel, message) => {
          const handler = this.handlers[channel]

          if (handler) {
            const msg = new Msg(channel, message)

            log.info(`[msg] Got message from ${channel}`)
            try {
              await msg.exec(handler)
              log.info('[msg] Message succesfully handled')

            } catch (error) {
              log.error('[msg] Message handler error:', error)

            }
          }
        })

        _.forEach(this.topics, address => client.subscribe(address))

        log.info('[msg] Listen topics:', this.topics)
      })
  }

  _listenQueues() {
    if (_.isEmpty(this.queues)) {
      return
    }

    const args = _.clone(this.queues)
    args.push(BRPOP_DELAY_IN_SECONDS)

    const listen = () => {
      this.client.brpopAsync(args)
        .then(async value => {
          if (value) {
            const [ qname, message ] = value

            const msg     = new Msg(qname, message)
            const handler = this.handlers[qname]

            log.info(`[msg] Got message from ${qname}`)
            try {
              await msg.exec(handler)
              log.info('[msg] Message succesfully handled')

            } catch (error) {
              log.error('[msg] Message handler error:', error)

            }
          }

          listen()
        })
    }

    listen()

    log.info('[msg] Listen queues:', this.queues)
  }

  listen() {
    return Promise.resolve()
      .then(() => this._listenTopics())
      .then(() => this._listenQueues())
  }
}

module.exports = Listener
