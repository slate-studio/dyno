'use strict'

const logger = require('../../../lib/log')
const redis  = require('../../../lib/db/redis')
const msg    = require('../../../lib/msg')
const RequestNamespace = require('../../../lib/requestNamespace')

const config = {
  redis: { host: '127.0.0.1', port: 6379 },
  log: { level: 'debug' }
}

let Message, Listener, listener, redisClient

const authenticationToken = new Buffer(JSON.stringify({
  sessionId: 'UNIQ_SESSION',
  userId:    'USER_ID'
})).toString('base64')

describe('Redis', () => {

  before(() => {
    return logger(config)
      .then(() => redis(config))
      .then(client => redisClient = client)
      .then(() => redisClient.flushallAsync())
      .then(() => redisClient.quitAsync())
      .then(() => msg(config))
      .then(({ globals }) => {
        Message  = globals.Message
        Listener = globals.Listener
      })
  })

  it('should listen topic', done => {
    const handlers = {
      'demo.topic1': msg => {
        expect(msg.object.demo).to.equal('data')
        done()
      },
      'demo.topic2': msg => {
        log.debug('MSG', msg)
      }
    }

    listener = Listener(handlers)
    listener.listen()
      .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
      .then(() => {
        const namespace = {
          authenticationToken,
          requestId: 'REQUEST_ID'
        }

        const requestNamespace = new RequestNamespace(namespace)
        requestNamespace.save([], () => {
          const message = Message({ demo: 'data' })
          message.publish('demo.topic1')
        })
      })
  })

  it('should listen to queue', done => {
    const handlers = {
      'demoQueue1': async msg => {
        expect(msg.object.demo).to.equal('data')
        setTimeout(done, 500)
      },
      'demoQueue2': async msg => {
        log.debug('MSG', msg)
      }
    }

    listener = Listener(handlers)
    listener.listen()
      .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
      .then(() => {
        const namespace = {
          authenticationToken,
          requestId: 'REQUEST_ID'
        }

        const requestNamespace = new RequestNamespace(namespace)
        requestNamespace.save([], () => {
          const message = Message({ demo: 'data' })
          message.send('demoQueue1')
        })
      })
  })

})
