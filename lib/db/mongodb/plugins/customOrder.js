'use strict'

module.exports = schema => {
  schema.add({ _position: { type: Number } })

  schema.pre('save', function (next) {
    this.constructor.find({}).sort({ position: -1 }).limit(1)
      .then(lastElement => {
        this._position = (lastElement._position || 1000) + 10
        next()
      })
  })

  schema.index({ _position: 1 })
}
