'use strict'

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

module.exports = {
  NotFoundError,
  TransactionError,
  DocumentNotFoundError
}
