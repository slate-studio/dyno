'use strict'

const _ = require('lodash')

const Http4xx = require('./http4xx')

class Http404 extends Http4xx {
  constructor(message) {
    super(message, 404)
    this.name = 'Not Found'
    this.message = (!_.isEmpty(message) ? message : this.name)
  }
}

module.exports = Http404