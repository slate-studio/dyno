'use strict'

const _ = require('lodash')

const Http = require('./http')

class Http4xx extends Http {
  constructor(message, statusCode) {
    super(message, statusCode)
    this.name = 'Client Error'
    this.message = (!_.isEmpty(message) ? message : this.name)
  }
}

module.exports = Http4xx