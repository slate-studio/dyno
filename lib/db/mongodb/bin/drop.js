#!/usr/bin/env node

'use strict'

const mongodb = require('mongodb')
const logger  = require('../../../log')
const config  = require('../../../config')

module.exports = logger(config)
  .then(() => {
    return new Promise(resolve => {
      mongodb.connect(config.mongodb.uri, (error, client) => {
        log.warn('[mongodb] Drop database:', config.mongodb.uri)
        client.db().dropDatabase(() => {
          client.close(resolve)
        })
      })
    })
  })
