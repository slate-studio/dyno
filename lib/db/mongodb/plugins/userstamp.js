'use strict'

const {RequestNamespace} = require('../../../requestNamespace')

module.exports = (schema, { requestNamespaceKey }) => {
  schema.add({ createdBy: String })
  schema.add({ updatedBy: String })

  const getUserId = () => {
    const requestNamespace = new RequestNamespace()
    return requestNamespace.get(requestNamespaceKey) || 'system'
  }

  const onSave = (object) => {
    const userId = getUserId()

    if (object.isNew) {
      object.createdBy = userId
      object.updatedBy = userId

    } else if (object.isModified()) {
      object.updatedBy = userId

    }
  }

  const onUpdate = (query) => {
    const userId  = getUserId()
    query._update = query._update || {}

    if (query._update['createdBy']) {
      delete query._update['createdBy']
    }

    query._update['$setOnInsert'] = query._update['$setOnInsert'] || {}
    query._update['$setOnInsert']['createdBy'] = userId

    query._update['updatedBy'] = userId
  }

  schema.pre('save', function(next) {
    onSave(this)
    next()
  })

  schema.pre('findOneAndUpdate', function(next) {
    if (this.op === 'findOneAndUpdate') {
      onUpdate(this)
    }

    next()
  })

  schema.pre('update', function(next) {
    if (this.op === 'update') {
      onUpdate(this)
    }

    next()
  })
}
