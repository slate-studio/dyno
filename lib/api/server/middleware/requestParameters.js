'use strict'

const _ = require('lodash')

const debug = require('debug')('swagger:requestParameters')

const parameters = (req, res, next) => {
  if (req.swagger) {
    const { operationId } = req.swagger.operation
    const parameters  = {}

    _.forEach(req.swagger.params, (param, key) => {
      parameters[key] = param.value
    })

    log.info({ operationId, parameters })

    req.swaggerOperationId = operationId
    req.swaggerParameters  = parameters

  } else {
    log.info(req.method, req.url)

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
