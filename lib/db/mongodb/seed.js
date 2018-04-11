'use strict'

const _ = require('lodash')

const config  = require('config')
const logger  = require('../../log')
const mongodb = require('./index')

const exitTimeout = 1000

module.exports = models => {
  return logger(config)
    .then(() => mongodb(config.mongodb))
    .then(db => {
      global.Model  = db.globals.Model
      global.Schema = db.globals.Schema

      const inserts = _.map(models, ({ model, options, data }) => {
        const dataSize = data.length

        if (dataSize == 0) {
          return Promise.resolve()
        }

        return Model(model, options || {}).insert(data)
          .then(() => log.info(`[mongodb] Seed ${model}`, options, dataSize))
      })

      return Promise.all(inserts)
        .then(() => db.closeConnection())
    })
    .catch(error => {
      log.error(error, 'Mongodb seed error')
      setTimeout(() => process.exit(1), exitTimeout)
    })
}
