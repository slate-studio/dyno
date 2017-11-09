'use strict'

const _ = require('lodash')

const Http4xx = require('./http4xx')

class Http400 extends Http4xx {
  constructor(message) {
    super(message, 400)
    this.name = 'Bad Request'
    this.message = (!_.isEmpty(message) ? message : this.name)
  }
}

module.exports = Http400