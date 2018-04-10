'use strict'

const _             = require('lodash')
const statuses      = require('statuses')
const config        = require('../../../config')
const rootPath      = process.cwd()
const SwaggerClient = require('swagger-client')
const Validator     = require('../../../oas/validator')
const Request       = require('./request')
const OperationMock = require('./operationMock')

class ApiClient {
  constructor(options = {}) {
    this.options         = options
    this.dependencies    = {}
    this.requests        = {}

    this.addOperationIds = {}

    this.Request         = Request
    this.OperationMock   = OperationMock

    this.spec = require(`${rootPath}/src/api/swagger.json`)
  }

  async initialize() {
    this.swaggerClient = await SwaggerClient({ spec: this.spec })

    for (let path in this.spec.paths) {
      const methods = this.spec.paths[path]

      for (let method in methods) {
        const operation   = methods[method]
        const operationId = operation.operationId

        if (operationId) {
          const options = Object.assign({ operationId }, this.options)
          this[operationId] = () => {
            const request = new Request(this, this.swaggerClient, options)
            this.requests[operationId].push(request)
            return request
          }

          this.requests[operationId] = []

          const dependency = operation['x-dependency-operation-ids'] || []
          this.dependencies[operationId]   = dependency
        }
      }
    }

    // NOTE Use appApiClient (server.apiClient) for getting built specs 
    //      for all dependent services. 
    //      Maybe there is a sense build them based on schemas files
    //      instead of use appApiClient
    for (let serviceName in this.options.appApiClient.services) {
      const service = this.options.appApiClient.services[serviceName]
      const spec    = service.client.spec
      this.addOperationIds[serviceName] = {}

      for (let path in spec.paths) {
        const methods = spec.paths[path]

        for (let method in methods) {
          const operation   = methods[method]
          const operationId = operation.operationId

          if (operationId) {
            this.addOperationIds[serviceName][operationId] = operation
          }
        }
      }
    }

    config.client.http.execute = async(options) => {
      const { sourceOperationId, requestOperationId } = options
      const { serviceName, requestParameters }        = options
      const destination         = `${serviceName}.${requestOperationId}`
      const request             = this.getCurrentRequest(sourceOperationId)
      const mockNotFoundMessage = `Mock not found for: ${destination}`

      if (!request) {
        throw new Error(mockNotFoundMessage)
      }

      const operationMock = request.getOperationMock(destination)

      if (!operationMock) {
        throw new Error(mockNotFoundMessage)
      }

      const operationSpec = this.getOperationSpec(serviceName, requestOperationId)

      this.executeMockForRequest({ operationMock, operationSpec, requestParameters })

      const statusCode = operationMock.getResponseStatus()
      const body       = operationMock.getResponseBody()
      const response   = {
        statusCode,
        body,
        ok:         !(statusCode >= 400),
        url:        `${options.protocol}//${options.hostname}${options.path}`,
        method:     options.method,
        statusText: statuses(statusCode),
        headers:    options.headers,
        text:       body,
        object:     body
      }

      return response
    }
  }

  clearCurrentRequest(operationId) {
    this.requests[operationId].shift()
  }

  getCurrentRequest(operationId) {
    return this.requests[operationId][0]
  }

  getOperationSpec(serviceName, operationId) {
    return this.addOperationIds[serviceName][operationId]
  }

  executeMockForRequest({ operationMock, operationSpec, requestParameters }) {
    const parameters          = operationMock.getParameters()
    const destination         = operationMock.getDestination()
    const mockNotFoundMessage = `Mock not found for: ${destination}`

    if (parameters) {
      const validator = new Validator(operationSpec)
      // NOTE date-time parameter passing as object, but should be string
      //      validation raises an exception in this situation
      validator.validateParameters(requestParameters)

      const verifyDifference = (requestParameters, parameters) => {
        const parametersKays        = _.keys(parameters)
        const requestParametersKeys = _.keys(requestParameters)
        const difference            = _.difference(parametersKays, requestParametersKeys)
        if (parametersKays.length !== requestParametersKeys.length || difference.length) {
          throw new Error(mockNotFoundMessage)
        }
      }

      const checkValue = (requestValue, mockValue, spec) => {
        if (spec.in == 'body') {
          return checkValue(requestValue, mockValue, spec.schema)
        }

        switch (true) {
          case spec.type === 'object':
            if (!_.isEmpty(mockValue)) {
              verifyDifference(requestValue, mockValue)

              for (let name in mockValue) {
                checkValue(requestValue[name], mockValue[name], spec.properties[name])
              }
            }
            break

          case spec.type === 'array':
            if (mockValue.length) {
              if (mockValue.length != requestValue.length) {
                throw new Error(mockNotFoundMessage)
              }

              for (let i = 0; i < mockValue.length; i++) {
                checkValue(requestValue[i], mockValue[i], spec.items)
              }
            }
            break

          default:
            const { format } = spec

            // if (_.includes(['date', 'date-time'], format)) {
            //   requestValue = validator.getStringDate(requestValue, format)
            //   mockValue    = validator.getStringDate(mockValue, format)
            // }

            if (requestValue != mockValue) {
              throw new Error(mockNotFoundMessage)
            }
            break

        }
      }

      verifyDifference(requestParameters, parameters)

      const parametersSpec = operationSpec.parameters

      for (let name in requestParameters) {
        const requestValue = requestParameters[name]
        const mockValue    = parameters[name]
        const spec         = _.find(parametersSpec, { name })

        checkValue(requestValue, mockValue, spec)
      }
    }

    operationMock.execute()
  }

  verifyDependency(operationId, operationMock) {
    const dependencyOperation = operationMock.getOperationId()

    if (!this.dependencies[operationId]) {
      throw new Error(`Operation ${operationId} doesn't exists`)
    }

    if (!_.includes(this.dependencies[operationId], dependencyOperation)) {
      const message = `Operation '${dependencyOperation}'  doesn't exists in the '${operationId}' dependencies`
      throw new Error(message)
    }
  }
}

module.exports = ApiClient
