'use strict'

module.exports = (schema, options) => {
  const { fieldName }       = options
  const orderableField      = {}
  orderableField[fieldName] = { type: Number }

  const orderableIndex      = { _deleted: 1 }
  orderableIndex[fieldName] = 1

  schema.add(orderableField)

  const sortBy = {}
  sortBy[fieldName] = -1

  schema.pre('save', function (next) {
    this.constructor.find({}).sort(sortBy).limit(1)
      .then(lastElement => {
        if (lastElement.length > 0) {
          this[fieldName] = (lastElement[0][fieldName] || 1000) + 10

        } else {
          this[fieldName] = 1000

        }

        next()
      })
  })

  schema.index(orderableIndex)
}
