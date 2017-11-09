'use strict'

const amqp   = require('amqplib')
const logger = require('../../lib/log')
const msg    = require('../../lib/msg')
const RequestNamespace = require('../../lib/requestNamespace')

const config = {
  rabbitmq: { uri: 'amqp://rabbitmq:rabbitmq@127.0.0.1:5672' },
  log: { level: 'debug' }
}

let Message, Listener, listener

const authenticationToken = new Buffer(JSON.stringify({
  sessionId: 'UNIQ_SESSION',
  userId:    'USER_ID'
})).toString('base64')

describe('Rabbitmq', () => {

  before(() => {
    return logger(config)
      .then(() => msg(config))
      .then(msg => {
        Message  = msg.globals.Message
        Listener = msg.globals.Listener
      })
  })

  it('should listen topic', done => {
    const handlers = {
      'demo.topic': msg => {
        expect(msg.object.demo).to.equal('data')
        done()
      }
    }

    listener = Listener(handlers)
    listener.listen()
      .then(() => {
        const namespace = {
          authenticationToken,
          requestId: 'REQUEST_ID'
        }

        const requestNamespace = new RequestNamespace(namespace)
        requestNamespace.save([], () => {
          const message = Message({ demo: 'data' })
          message.publish('demo.topic')
        })
      })
  })

  it('should listen to queue', done => {
    const handlers = {
      'demoQueue': (msg, next) => {
        expect(msg.object.demo).to.equal('data')
        next()
        setTimeout(done, 500)
      }
    }

    listener = Listener(handlers)
    listener.listen()
      .then(() => {
        const namespace = {
          authenticationToken,
          requestId: 'REQUEST_ID'
        }

        const requestNamespace = new RequestNamespace(namespace)
        requestNamespace.save([], () => {
          const message = Message({ demo: 'data' })
          message.send('demoQueue')
        })
      })
  })

})
