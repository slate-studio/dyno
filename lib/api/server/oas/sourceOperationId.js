'use strict'

const debug = require('debug')('swagger:requestParameters')

const parameters = (req, res, next) => {
  if (req.swagger) {
    const { operationId } = req.swagger.operation
    req.requestNamespace.set('operationId', operationId)

    if (!req.headers['x-source-operation-id']) {
      req.headers['x-source-operation-id'] = operationId
      req.requestNamespace.set('sourceOperationId', operationId)
    }

  }

  next()
}

module.exports = function create(fittingDef) {
  debug('config: %j', fittingDef)

  return function requestParameters(context, cb) {
    debug('exec')
    parameters(context.request, context.response, cb)
  }
}
