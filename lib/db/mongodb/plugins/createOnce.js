'use strict'

module.exports = schema => {
  schema.static('createOnce', function(params) {
    return this.create(params)
      .catch(error => {
        if (error.name == 'MongoError') {
          // TODO: Catch E11000 duplication error in more accurate way
          log.warn(error)
          return null

        } else {
          throw error

        }
      })
  })
}
