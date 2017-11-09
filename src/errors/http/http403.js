'use strict'

const _ = require('lodash')

const Http4xx = require('./http4xx')

class Http403 extends Http4xx {
  constructor(message) {
    super(message, 403)
    this.name = 'Forbidden'
    this.message = (!_.isEmpty(message) ? message : this.name)
  }
}

module.exports = Http403