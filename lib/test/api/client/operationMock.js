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
    // TODO: This will probably move to other place
    const body          = JSON.stringify(this.responseBody)
    const statusCode    = this.responseStatus
    const statusMessage = statuses(statusCode)

    this.hasExecuted = true
    return { statusCode, statusMessage, headers, body }
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
    if (responseStatus != 500) {
      const validator   = new Validator(this.spec)
      const operationId = this.getOperationId()
      validator.validateResponseStatus(responseStatus, operationId)
    }

    this.responseStatus = responseStatus
    return this
  }

  getResponseStatus() {
    return this.responseStatus
  }

  setResponseBody(responseBody) {
    const responseStatus = this.getResponseStatus()
    if (responseStatus != 500) {
      const validator      = new Validator(this.spec)
      const operationId    = this.getOperationId()
      validator.validateResponseBody(responseStatus, responseBody, operationId)
    }

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
      const mockValue    = this.parameters[name]
      const spec         = _.find(parametersSpec, { name })

      if (!this._compareParametersValue(name, requestValue, mockValue, spec)) {
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

  _compareParametersValue(name, requestValue, mockValue, spec) {
    if (!spec) {
      throw new Error(`You trying to send ${name}:${requestValue}, wich not specified in schema`)
    }

    if (spec.in == 'body') {
      return this._compareParametersValue(name, requestValue, mockValue, spec.schema)
    }

    switch (true) {
      case spec.type === 'object':
        if (!_.isEmpty(mockValue) && spec.properties) {
          if (!this._checkParametersDifference(requestValue, mockValue)) {
            return false
          }

          for (let name in mockValue) {
            if (!this._compareParametersValue(name, requestValue[name], mockValue[name], spec.properties[name])) {
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
            if (!this._compareParametersValue(name, requestValue[i], mockValue[i], spec.items)) {
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
