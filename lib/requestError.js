'use strict'

class ResponseError extends Error {
  constructor(message, httpStatusCode, originalError) {
    super(message)

    this.httpStatusCode = httpStatusCode
    this.originalError  = originalError
  }
}

modules.exports = ResponseError
