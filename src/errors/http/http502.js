'use strict'

const _ = require('lodash')

const Http5xx = require('./http5xx')

class Http502 extends Http5xx {
  constructor(message) {
    super(message, 502)
    this.name = 'Bad Gateway'
    this.message = (!_.isEmpty(message) ? message : this.name)
  }
}

module.exports = Http502