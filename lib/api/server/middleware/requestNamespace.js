'use strict'

const _ = require('lodash')

const debug = require('debug')('swagger:requestNamespace')
const RequestNamespace        = require('../../../requestNamespace')
const { getRequestNamespace } = require('../../../requestNamespace')

const createRequestNamespace = (req, res, next) => {
  const { headers } = req

  const sourceRequestId     = _.get(headers, 'x-source-request-id')
  const requestId           = _.get(headers, 'x-request-id', sourceRequestId)
  const sourceOperationId   = _.get(headers, 'x-source-operation-id')
  const authenticationToken = _.get(headers, 'x-authentication-token')
  const instanceId          = _.get(headers, 'x-instance-id')
  const namespace           = { requestId, sourceOperationId, instanceId }

  _.extend(namespace, getRequestNamespace(authenticationToken))

  if (sourceRequestId) {
    res.setHeader('x-source-request-id', sourceRequestId)
  }

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
