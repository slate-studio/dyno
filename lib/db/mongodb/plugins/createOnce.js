'use strict'

module.exports = schema => {
  schema.static('createOnce', function(params) {
    return this.create(params)
      .catch(error => {
        if (error.name == 'BulkWriteError' && error.code == 11000) {
          return null

        } else {
          throw error

        }
      })
  })
}
