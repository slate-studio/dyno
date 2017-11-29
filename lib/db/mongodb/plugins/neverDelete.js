'use strict'

const _ = require('lodash')

const MONGOOSE_HOOKS = [
  'count',
  'find',
  'findOne',
  'findOneAndUpdate',
  // NOTE: Not tested ----------------------------------
  'update',
  'remove',
  'findOneAndRemove',
  'insertMany' ]

module.exports = schema => {
  schema.add({ _deleted: { type: Boolean, default: false } })

  schema.static('deleteMany', function(query) {
    const params = { $set: { _deleted: true } }
    return this.updateMany(query, params)
  })

  schema.method('delete', function() {
    const params = { $set: { _deleted: true } }
    return this.update(params)
  })

  _.forEach(MONGOOSE_HOOKS, hook => {
    schema.pre(hook, function(next) {
      if (this.model.modelName == 'IdentityCounter') {
        return next()
      }

      this._conditions._deleted = false
      next()
    })
  })

  schema.static('drop', function(forceDrop = false) {
    if (process.env.NODE_ENV === 'production' && !forceDrop) {
      return Promise.resolve()
    }

    return new Promise(resolve => this.collection.drop(resolve))
  })
}
