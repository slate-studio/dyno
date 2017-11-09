'use strict'

const _ = require('lodash')

class Base extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)

    } else {
      this.stack = (new Error(message)).stack

    }
  }

  toPlainObject() {
    const output = {
      message:  this.message
    }

    if (_.has(this, 'code')) {
      output.code = this.code
    }

    return output
  }
}

module.exports = Base
