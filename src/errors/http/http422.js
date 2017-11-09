'use strict'

const _ = require('lodash')

const Http4xx = require('./http4xx')

class Http422 extends Http4xx {
  constructor(message) {
    super(message, 422)
    this.name = 'Unprocessable Entity'
    this.message = (!_.isEmpty(message) ? message : this.name)
  }
}

module.exports = Http422