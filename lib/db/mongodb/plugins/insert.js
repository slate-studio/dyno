'use strict'

const _ = require('lodash')

module.exports = schema => {
  schema.static('insert', function(data) {
    const dataSize = data.length
    const inserts  = _.map(data, (document, index) => {
      const timestamp = new Date()

      document._integerId = document._integerId || index + 1
      document.createdAt  = document.createdAt  || timestamp
      document.updatedAt  = document.updatedAt  || timestamp
      document._deleted   = document._deleted   || false

      return this.collection.insert(document)
    })

    return Promise.all(inserts)
      .then(() => this.nextCount())
      .then(nextCount => nextCount - 1 + dataSize)
      .then(newCount => this.setCount(newCount))
  })
}
