'use strict'

const _ = require('lodash')

const Base = require('./../base')

class Http extends Base {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
    this.name = this.constructor.name
  }

  setServiceName(serviceName) {
    this.serviceName = serviceName
  }

  getStatusCode() {
    return _.get(this, 'statusCode', null)
  }

  setOperationId(operationId) {
    this.operationId = operationId
  }

  setErrors(errors) {
    this.errors = errors
  }

  toPlainObject() {
  	const output = super.toPlainObject()

    if (_.has(this, 'statusCode')) {
      output.statusCode = this.getStatusCode()
  	}

  	if (_.has(this, 'serviceName')) {
      output.serviceName = this.serviceName
  	}

  	if (_.has(this, 'operationId')) {
      output.operationId = this.operationId
  	}

    if (_.has(this, 'errors')) {
      output.errors = this.errors
    }

    return output
  }
}

module.exports = Http