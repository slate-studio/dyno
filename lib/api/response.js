'use strict'

class Response {
  constructor(value) {
    this.data = null

    if (!value) {
      return
    }

    if (value instanceof Array) {
      this.data = this._normalizeArray(value)
      return
    }

    if (value instanceof Object) {
      this.data = this._normalizeObject(value)
      return
    }

    throw new Error('Response value should be of an Array or Object type')
  }

  _normalizeValue(value) {
    if (value instanceof Object) {
      return this._normalizeObject(value)

    }

    if (value instanceof Array) {
      return this._normalizeArray(value)

    }

    return value
  }

  _normalizeArray(array) {
    return array.map(item => this._normalizeValue(item))
  }

  _normalizeObject(object) {
    if (object.toObject) {
      object = object.toObject()
    }

    for (const key in object) {
      if (key[0] == '_') {
        delete object[key]

      } else {
        object[key] = this._normalizeValue(object[key])

      }
    }

    return object
  }

  getData() {
    return this.data
  }
}

module.exports = Response
