'use strict'

const _ = require('lodash')

const debug = require('debug')('swagger:requestParameters')

const filter = (parameters) => {
  for (const key in parameters) {
    if (typeof parameters[key] === 'object') {
      filter(parameters[key])

    } else if (typeof parameters[key] === 'array') {
      for (const value of parameters[key]) {
        filter(value)
      }

    } else if (key === 'password') {
      parameters[key] = '[FILTERED]'

    }
  }
}

const parameters = (req, res, next) => {
  const method = req.method
  const url    = req.url

  if (req.swagger) {
    const { operationId } = req.swagger.operation
    const parameters  = {}

    for (const key in req.swagger.params) {
      parameters[key] = req.swagger.params[key].value
    }

    req.swaggerOperationId = operationId
    req.swaggerParameters  = parameters

    const isFileUpload = req.is('multipart/form-data')

    if(isFileUpload) {
      log.info({ method, url, operationId })

    } else {
      const filtered = _.cloneDeep(parameters)
      filter(filtered)

      log.info({ method, url, operationId, parameters: filtered })

    }

  } else {
    log.info(method, url)

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
