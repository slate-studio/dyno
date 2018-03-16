'use strict'

class RequestError extends Error {
  constructor(message, httpStatusCode, originalError) {
    super(message)

    this.httpStatusCode = httpStatusCode
    this.originalError  = originalError
  }
}

module.exports = RequestError
