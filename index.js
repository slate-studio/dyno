'use strict'

const server = require('./lib/api/server')
const {Base, Create, Delete, Export, Index, Read, Update} = require('./lib/api/actions')
const {DocumentNotFoundError, NotFoundError, TransactionError} = require('./lib/api/errors')
const client = require('./src/swagger/client')
const redis = require('./lib/db/redis')
const mongodb = require('./lib/db/mongodb')
const log = require('./lib/log')
const msg = require('./lib/msg')
const {request, pluralize, buildAuthenticationToken} = require('./src/utils')
const RequestNamespace = require('./lib/requestNamespace')
const {getRequestNamespace} = require('./lib/requestNamespace')
module.exports = {
  api:   {
    server,
    errors:  {DocumentNotFoundError, NotFoundError, TransactionError},
    client,
    actions: {
      Base,
      Create,
      Delete,
      Export,
      Index,
      Read,
      Update
    }
  },
  db:    {redis, mongodb},
  log,
  msg,
  utils: {request, pluralize, buildAuthenticationToken},
  RequestNamespace,
  getRequestNamespace
}
