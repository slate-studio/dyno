'use strict'

const _ = require('lodash')

const Http4xx = require('./http4xx')

class Http423 extends Http4xx {
  constructor(message) {
    super(message, 423)
    this.name = 'Locked'
    this.message = (!_.isEmpty(message) ? message : this.name)
  }
}

module.exports = Http423