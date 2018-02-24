'use strict'

// TODO: Update first if update fails then create
module.exports = schema => {
  schema.static('createOrUpdate', function(query, parameters) {
    return this.findOne(query)
      .then(doc => {
        if (doc) {
          return doc.update(parameters).then(() => doc)

        } else {
          return this.create(parameters)

        }
      })
  })
}
