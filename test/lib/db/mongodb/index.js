'use strict'

global.mongoose = require('mongoose')

const uri = 'mongodb://127.0.0.1:27017/service-test'

describe('Mongodb:', () => {

  describe('Plugins:', () => {

    before(() => mongoose.connect(uri, { useMongoClient: true }))

    require('./plugins/autoIncrement')
    require('./plugins/export')
    require('./plugins/neverDelete')
    require('./plugins/simulateUnhandledError')
  })

})
