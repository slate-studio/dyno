'use strict'

const {Update, Read, Index, Export, Delete, Create, Base} = require('./actions')
const {TransactionError, NotFoundError, DocumentNotFoundError} = require('./errors')
const client = require('./client')
const server = require('./server')
const {Server} = require('./server')

exports = module.exports = {
  errors:  {TransactionError, NotFoundError, DocumentNotFoundError},
  actions: {Update, Read, Index, Export, Delete, Create, Base},
  client,
  server,
  Server
}
