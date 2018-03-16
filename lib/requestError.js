'use strict'

class RequestError extends Error {
  constructor(message, httpStatusCode, originalError) {
    super(message)

    this.name = 'RequestError'
    this.httpStatusCode = httpStatusCode

    if (originalError) {
      this.originalError = originalError
    }
  }
}

module.exports = RequestError
