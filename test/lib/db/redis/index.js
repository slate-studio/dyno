'use strict'

const logger = require('../../../lib/log')
const redis  = require('../../../lib/db/redis')

describe('Redis:', () => {

  it('should connect to server', done => {
    const config = {
      redis: { host: '127.0.0.1', port: 6379 },
      log: { level: 'debug' }
    }

    logger(config)
      .then(() => redis(config))
      .then(client => {
        client.setAsync('test', 'Value')
        done()
      })
  })

})
