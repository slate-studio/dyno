'use strict'

// TODO: Update first if update fails then create
module.exports = schema => {
  schema.static('createOrUpdate', function(query, attributes) {
    return this.findOne(query)
      .then(doc => {
        if (doc) {
          return doc.update(attributes).then(() => doc)

        } else {
          return this.create(attributes)

        }
      })
  })
}
