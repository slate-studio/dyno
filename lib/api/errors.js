'use strict'

const _ = require('lodash')

class InternalServerError extends Error {
  constructor(error) {
    super('Internal Server Error')

    this.name           = this.constructor.name
    this.httpStatusCode = 500
    this.originalError  = error
  }
}

class TransactionError extends Error {
  constructor(action, transactionError) {
    const { req } = action
    let { swaggerOperationId: operationId, swaggerParameters: parameters } = req

    parameters = JSON.stringify(parameters)
    super(`Operation ${operationId} has failed: ${parameters}`)

    this.name           = this.constructor.name
    this.httpStatusCode = 'Internal Server Error'
    this.errors         = [ transactionError ]
  }
}

class NotFoundError extends Error {
  constructor(modelName, query, httpError) {
    query = JSON.stringify(query)
    super(`${modelName} resource is not found: ${query}`)

    this.name           = `${modelName}${this.constructor.name}`
    this.httpStatusCode = 'Unprocessable Entity'
    this.errors         = [ httpError ]
  }
}

class DocumentNotFoundError extends Error {
  constructor(modelName, query) {
    query = JSON.stringify(query)
    super(`${modelName} document is not found: ${query}`)

    this.name           = `${modelName}${this.constructor.name}`
    this.httpStatusCode = 'Not Found'
  }
}

const normalizedError = error => {
  const exportedErrorFields = [
    'name', 'message', 'originalError', 'service',
    'operationId', 'sourceOperationId', 'requestId', 'sourceRequestId'
  ]

  if (error.originalError && Object.keys(error.originalError).length) {
    error.originalError = normalizedError(error.originalError)
  }

  return _.pick(error, exportedErrorFields)
}

module.exports = {
  InternalServerError,
  NotFoundError,
  TransactionError,
  DocumentNotFoundError,
  normalizedError
}
