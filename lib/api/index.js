'use strict'

const actions = require('./actions')
const {TransactionError, NotFoundError, DocumentNotFoundError} = require('./errors')
const {Server} = require('./server')

module.exports = {
  errors:  {TransactionError, NotFoundError, DocumentNotFoundError},
  actions,
  client: require('./client'),
  server: require('./server'),
  Server
}
