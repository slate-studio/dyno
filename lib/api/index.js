'use strict'

const actions = require('./actions')
const {TransactionError, NotFoundError, DocumentNotFoundError} = require('./errors')
const client = require('./client')
const server = require('./server')
const {Server} = require('./server')

exports = module.exports = {
  errors:  {TransactionError, NotFoundError, DocumentNotFoundError},
  actions,
  client,
  server,
  Server
}
