'use strict'

module.exports = schema => {
  schema.add({ position: { type: Number } })

  schema.pre('save', function (next) {
    this.constructor.find({}).sort({ position: -1 }).limit(1)
      .then(lastElement => {
        if (lastElement.length > 0) {
          this.position = (lastElement[0].position || 1000) + 10
        } else {
          this.position = 1000
        }
        next()
      })
  })

  schema.index({ position: 1 })
}
