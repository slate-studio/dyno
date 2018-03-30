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
// TODO: Check findById and update... remove...

class MissingModelNameError extends Error {
  constructor() {
    super('Model name is not defined in options')
    this.name = this.constructor.name
  }
}

class BadAutoIncrementFieldValueError extends Error {
  constructor() {
    super('Auto incremented value is not a number')
    this.name = this.constructor.name
  }
}

class UpdateAutoIncrementFieldValueError extends Error {
  constructor() {
    super('Update of auto incremented value is forbidden')
    this.name = this.constructor.name
  }
}

const defaults = {
  field:       '_integerId',
  startAt:     1,
  incrementBy: 1
}

module.exports = (schema, options = {}) => {
  const { model, mongoose } = options

  if (!model) {
    throw new MissingModelNameError()
  }

  let IdentityCounter

  try {
    IdentityCounter = mongoose.model('IdentityCounter')

  } catch (error) {
    if (error.name === 'MissingSchemaError') {
      const counterSchema = new mongoose.Schema({
        model: { type: String, require: true },
        field: { type: String, require: true },
        count: { type: Number, default: 0 }
      })

      counterSchema.index({ field: 1, model: 1 }, { unique: true })

      IdentityCounter = mongoose.model('IdentityCounter', counterSchema)

    } else {
      throw error

    }
  }

  const fields   = {}
  const settings = _.assignIn({}, defaults, options)

  fields[settings.field] = {
    type:    Number,
    require: true,
    unique:  true
  }

  schema.add(fields)

  const query = _.pick(settings, [ 'model', 'field' ])
  const initializeIdentityCounter = async() => {
    let counter = await IdentityCounter.findOne(query)

    if (!counter) {
      const params = _.pick(settings, ['model', 'field'])
      params.count = settings.startAt - settings.incrementBy

      counter = new IdentityCounter(params)
      await counter.save()
    }
  }

  const initializeIdentityCounterPromise = initializeIdentityCounter()

  const nextCount = async() => {
    await initializeIdentityCounterPromise

    const query   = _.pick(settings, ['model', 'field'])
    const counter = await IdentityCounter.findOne(query)

    return counter.count + settings.incrementBy
  }

  const resetCount = async() => {
    await initializeIdentityCounterPromise

    const query  = _.pick(settings, ['model', 'field'])
    const params = { count: settings.startAt - settings.incrementBy }

    await IdentityCounter.findOneAndUpdate(query, params, { new: true })
    return settings.startAt
  }

  const setCount = async(value) => {
    value = parseInt(value)

    await initializeIdentityCounterPromise

    const query  = _.pick(settings, [ 'model', 'field' ])
    const params = { count: value }

    await IdentityCounter.findOneAndUpdate(query, params)

    return value
  }

  schema.method('nextCount', nextCount)
  schema.static('nextCount', nextCount)

  schema.method('resetCount', resetCount)
  schema.static('resetCount', resetCount)

  schema.method('setCount', setCount)
  schema.static('setCount', setCount)

  schema.pre('save', async function(next) {
    if (this.isNew) {
      const count = this[settings.field]

      await initializeIdentityCounterPromise
      const query = _.pick(settings, [ 'model', 'field' ])

      if (count) {
        const isCountInteger = _.isInteger(count)

        if (!isCountInteger) {
          throw new BadAutoIncrementFieldValueError()
        }

        query.count = { $lt: count }

        // NOTE: This operation does nothing if count is less then value
        //       stored in IdentityCounter and would raise exception if
        //       count value is not unique.
        await IdentityCounter.findOneAndUpdate(query, { count })

      } else {
        const params = { $inc: { count: settings.incrementBy } }

        const identityCounter = await IdentityCounter.findOneAndUpdate(query, params, { new: true })
        this[settings.field]  = identityCounter.count

      }

    } else {
      const isUpdateAutoIncrementField = _.includes(this.modifiedPaths(), settings.field)

      if (isUpdateAutoIncrementField) {
        throw new UpdateAutoIncrementFieldValueError()

      }
    }

    return next()
  })

  for (const name of MONGOOSE_HOOKS) {
    schema.pre(name, function(next) {
      if (this.model.modelName != 'IdentityCounter') {
        if (this._conditions._id) {
          const integerId = Number(this._conditions._id)

          if (!isNaN(integerId)) {
            delete this._conditions._id
            this._conditions[settings.field] = integerId

          }
        }
      }

      next()
    })
  }
}
