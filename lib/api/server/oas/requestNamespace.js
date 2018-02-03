'use strict'

const _ = require('lodash')

const debug = require('debug')('swagger:requestNamespace')
const RequestNamespace        = require('../../../requestNamespace')

const createRequestNamespace = (req, res, next) => {
  const { headers } = req

  const requestId           = _.get(headers, 'x-request-id')
  const sourceOperationId   = _.get(headers, 'x-source-operation-id')
  const authenticationToken = _.get(headers, 'authorization')
  const namespace           = { requestId, sourceOperationId }

  _.extend(namespace, RequestNamespace.getRequestNamespace(authenticationToken))

  if (requestId) {
    res.setHeader('x-request-id', requestId)
  }

  req.requestNamespace = new RequestNamespace(namespace)
  req.requestNamespace.save([ req, res ], next)
}

exports = module.exports = function create(fittingDef) {
  debug('config: %j', fittingDef)

  return function requestNamespace(context, cb) {
    debug('exec')
    createRequestNamespace(context.request, context.response, cb)
  }
}

exports.createRequestNamespace = createRequestNamespace
