'use strict'

const _ = require('lodash')
const statuses = require('statuses')
const errors   = require('../errors')
const config   = require('../../config')
const RequestNamespace = require('../../requestNamespace')
const RequestError     = require('../../requestError')

module.exports = (req, res, originalError={}) => {
  let error, status

  const isRuntimeError = !originalError.httpStatusCode

  if (isRuntimeError) {
    const errorName = 'Internal Server Error'
    error = new RequestError(errorName, errorName, originalError)
    error.stack = originalError.stack
    log.error(error)

  } else {
    error = originalError
    log.debug(error, `${error}`)

  }

  status = error.httpStatusCode

  if (_.isString(status)) {
    status = statuses(status)
  }

  const requestNamespace = new RequestNamespace()
  const serviceName = config.service.name
  const operationId = _.get('req.swagger.operation.operationId')

  const normalizedError  = {
    operationId,
    serviceName,
    name:              error.name,
    message:           error.message,
    originalError:     error.originalError,
    requestId:         requestNamespace.get('requestId'),
    sourceRequestId:   requestNamespace.get('sourceRequestId'),
    sourceOperationId: requestNamespace.get('sourceOperationId')
  }

  return res.status(status).json(normalizedError)
}
