'use strict'

const _         = require('lodash')
const statuses  = require('statuses')
const Validator = require('../../../oas/validator')

class OperationMock {
  constructor(destination) {
    const [serviceName, operationId] = destination.split('.')
    this.hasExecuted  = false
    this.destination  = destination
    this.operationId  = operationId
    this.serviceName  = serviceName
    this.parameters   = null
    this.responseBody = null
    this.responseStatus = 200

    this.spec = OperationMock.getSpec(serviceName, operationId)
  }

  static setSpecs(apiClient) {
    this.specs = {}

    if (!apiClient.services) {
      return
    }

    const specs = _.map(apiClient.services, service => {
      return { name: service.name, spec: service.client.spec }
    })

    for (let object of specs) {
      const { name, spec }  = object
      this.specs[name] = {}

      for (let path in spec.paths) {
        const methods = spec.paths[path]

        for (let method in methods) {
          const operation   = methods[method]
          const operationId = operation.operationId

          if (operationId) {
            this.specs[name][operationId] = operation
          }
        }
      }
    }
  }

  static getSpec(serviceName, operationId) {
    return this.specs[serviceName][operationId]
  }

  execute({ url, method, headers }) {
    const response   = {
      ok:         !(this.responseStatus >= 400),
      statusCode: this.responseStatus,
      statusText: statuses(this.responseStatus),
      body:       this.responseBody,
      text:       this.responseBody,
      object:     this.responseBody,
      url,
      method,
      headers
    }

    this.hasExecuted = true
    return response
  }

  isDone() {
    return this.hasExecuted
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
    const validator   = new Validator(this.spec)
    const operationId = this.getOperationId()
    validator.validateResponseStatus(responseStatus, operationId)

    this.responseStatus = responseStatus
    return this
  }

  getResponseStatus() {
    return this.responseStatus
  }

  setResponseBody(responseBody) {
    const validator      = new Validator(this.spec)
    const responseStatus = this.getResponseStatus()
    const operationId    = this.getOperationId()
    validator.validateResponseBody(responseStatus, responseBody, operationId)

    this.responseBody = responseBody
    return this
  }

  getResponseBody() {
    return this.responseBody
  }

  isMatchOfParameters(parameters) {
    if (!this._checkParametersDifference(parameters, this.parameters)) {
      return false
    }

    const parametersSpec = this.spec.parameters

    for (let name in parameters) {
      const requestValue = parameters[name]
      const mockValue    = parameters[name]
      const spec         = _.find(parametersSpec, { name })

      if (!this._compareParametersValue(requestValue, mockValue, spec)) {
        return false
      }
    }

    return true
  }

  _checkParametersDifference(requestParameters, mockParameters) {
    const mockParametersKays    = _.keys(mockParameters)
    const requestParametersKeys = _.keys(requestParameters)
    const difference            = _.difference(mockParametersKays, requestParametersKeys)

    return (mockParametersKays.length == requestParametersKeys.length && !difference.length)
  }

  _compareParametersValue(requestValue, mockValue, spec) {
    if (spec.in == 'body') {
      return this._compareParametersValue(requestValue, mockValue, spec.schema)
    }

    switch (true) {
      case spec.type === 'object':
        if (!_.isEmpty(mockValue)) {
          if (!this._checkParametersDifference(requestValue, mockValue)) {
            return false
          }

          for (let name in mockValue) {
            if (!this._compareParametersValue(requestValue[name], mockValue[name], spec.properties[name])) {
              return false
            }
          }
        }
        break

      case spec.type === 'array':
        if (mockValue.length) {
          if (mockValue.length != requestValue.length) {
            return false
          }

          for (let i = 0; i < mockValue.length; i++) {
            if (!this._compareParametersValue(requestValue[i], mockValue[i], spec.items)) {
              return false
            }
          }
        }
        break

      default:
        if (requestValue != mockValue) {
          return false
        }
        break
    }

    return true
  }
}

module.exports = OperationMock
