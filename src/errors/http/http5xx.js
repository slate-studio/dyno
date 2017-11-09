'use strict'

const _ = require('lodash')

const Http = require('./http')

class Http5xx extends Http {
  constructor(message, statusCode) {
    super(message, statusCode)
    this.name = 'Server Error'
    this.message = (!_.isEmpty(message) ? message : this.name)
  }
}

module.exports = Http5xx