'use strict'

const _ = require('lodash')

const errors = [
  'http',
  'http4xx',
  'http400',
  'http401',
  'http403',
  'http404',
  'http422',
  'http423',
  'http5xx',
  'http500',
  'http502',
]

errors.forEach(name => {
  module.exports[_.upperFirst(name)] = require(`./${name}`)
})