'use strict'

module.exports = schema => {
  schema.add({ position: { type: Number } })

  schema.pre('save', function (next) {
    this.constructor.find({}).sort({ position: -1 }).limit(1)
      .then(lastElement => {
        this.position = (lastElement.position || 1000) + 10
        next()
      })
  })

  schema.index({ position: 1 })
}
