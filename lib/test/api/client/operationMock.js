'use strict'

// const _ = require('lodash')

class OperationMock {
  constructor(destination) {
    const [serviceName, operationId] = destination.split('.')

    this.destination    = destination
    this.operationId    = operationId
    this.serviceName    = serviceName
    this.parameters     = null
    this.responseStatus = 200
    this.responseBody   = null

    this.isDone = false
  }

  execute() {
    this.isDone = true
  }

  done() {
    if (!this.isDone) {
      throw new Error(`Operation mock not yet satisfied: ${this.serviceName}.${this.operationId}`)
    }
  }

  getDestination() {
    return this.destination
  }

  getOperationId() {
    return this.operationId
  }

  getServiceName() {
    return this.serviceName
  }

  setParameters(parameters = {}) {
    this.parameters = parameters
    return this
  }

  getParameters() {
    return  this.parameters
  }

  setResponseStatus(responseStatus) {
    this.responseStatus = responseStatus
    return this
  }

  getResponseStatus() {
    return this.responseStatus
  }

  setResponseBody(responseBody) {
    this.responseBody = responseBody
    return this
  }

  getResponseBody() {
    return this.responseBody
  }
}

module.exports = OperationMock
