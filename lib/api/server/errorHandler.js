'use strict'

const _ = require('lodash')
const statuses = require('statuses')
const errors   = require('../errors')

module.exports = (req, res, error) => {
  log.debug(error)

  let status = error.httpStatusCode

  if (!status) {
    error  = new errors.InternalServerError(error)
    status = error.httpStatusCode
    log.error(error)
  }

  if (_.isString(status)) {
    status = statuses(status)
  }

  const requestNamespace = new RequestNamespace()
  const normalizedError = {
    name:              error.name,
    message:           error.message,
    originalError:     error.originalError || {},
    serviceName:       config.service.name,
    requestId:         requestNamespace.get('requestId'),
    operationId:       this.req.swagger.operation.operationId,
    sourceRequestId:   requestNamespace.get('sourceRequestId'),
    sourceOperationId: requestNamespace.get('sourceOperationId')
  }

  return res.status(status).json(normalizedError)
}
