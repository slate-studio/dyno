'use strict'

const _ = require('lodash')
const statuses = require('statuses')
const errors   = require('../errors')
const config   = require('../../config')
const RequestNamespace = require('../../requestNamespace')

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
  const serviceName      = config.service.name
  const normalizedError  = {
    serviceName,
    name:              error.name,
    message:           error.message,
    originalError:     error.originalError || {},
    requestId:         requestNamespace.get('requestId'),
    operationId:       req.swagger.operation.operationId,
    sourceRequestId:   requestNamespace.get('sourceRequestId'),
    sourceOperationId: requestNamespace.get('sourceOperationId')
  }

  return res.status(status).json(normalizedError)
}
