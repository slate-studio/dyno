'use strict'

const _ = require('lodash')

const Http5xx = require('./http5xx')

class Http500 extends Http5xx {
  constructor(message) {
    super(message, 500)
    this.name = 'Internal Application Error'
    this.message = (!_.isEmpty(message) ? message : this.name)
  }
}

module.exports = Http500