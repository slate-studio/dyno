'use strict'

const _ = require('lodash')

const errors = [
  'base',
  'http',
  'documentNotFound',
  'userSessionNotFound',
  'authenticationTokenNotProvided',
]

errors.forEach(name => {
  module.exports[_.upperFirst(name)] = require(`./${name}`)
})
