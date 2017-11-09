'use strict'

const _ = require('lodash')

const Http4xx = require('./http4xx')

class Http401 extends Http4xx {
  constructor(message) {
    super(message, 401)
    this.name = 'Unauthorized'
    this.message = (!_.isEmpty(message) ? message : this.name)
  }
}

module.exports = Http401