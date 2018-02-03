'use strict'

const {Server, server, errors, client, actions} = require('./lib/api')
const {redis, mongodb, mongodbStaff, redisStaff} = require('./lib/db')
const log = require('./lib/log')
const {ConnectMsg} = require('./lib/msg')
const utils = require('./src/utils')
const RequestNamespace = require('./lib/RequestNamespace')

module.exports = {
  api:      {Server, server, errors, client, actions},
  db:       {redis, mongodb, mongodbStaff, redisStaff},
  log,
  msg:      require('./lib/msg'),
  msgStaff: {ConnectMsg},
  utils,
  RequestNamespace
}
