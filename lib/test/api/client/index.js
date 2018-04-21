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
    this.options       = options
    this.OperationMock = OperationMock
    this.Request       = Request

    OperationMock.setSpecs(this.options.appApiClient)

    config.client.request = ApiClient.request
  }

  async initialize() {
    const spec = require(`${rootPath}/src/api/swagger.json`)
    this.swaggerClient = await SwaggerClient({ spec })

    ApiClient.dependencies    = {}
    ApiClient.operationsSpecs = {}

    for (let path in this.swaggerClient.spec.paths) {
      const methods = this.swaggerClient.spec.paths[path]

      for (let method in methods) {
        const operation   = methods[method]
        const operationId = operation.operationId

        if (operationId) {
          const options = Object.assign({ operationId }, this.options)
          this[operationId] = () => {
            if (ApiClient.getRequest()) {
              throw new Error('Can\'t create request because previous request has not finished yet')
            }

            const request = new Request(this.swaggerClient, options)
            ApiClient.setRequest(request)
            return request
          }

          const dependency = operation['x-dependency-operation-ids'] || []
          ApiClient.dependencies[operationId]    = dependency
          ApiClient.operationsSpecs[operationId] = operation
        }
      }
    }
  }

  static async request(options) {
    const jsonParameters      = JSON.stringify(options.requestParameters)
    options.requestParameters = JSON.parse(jsonParameters)

    const { requestOperationId, serviceName, requestParameters } = options

    const operationSpec = OperationMock.getSpec(serviceName, requestOperationId)

    const validator = new Validator(operationSpec)
    validator.validateParameters(requestParameters)

    const request = ApiClient.getRequest()
    const operationMock = request.getOperationMock(
      serviceName,
      requestOperationId,
      requestParameters
    )

    if (!operationMock) {
      throw new Error(`OperationMock not found for: ${serviceName}.${requestOperationId} parameters: ${JSON.stringify(requestParameters)}`)
    }

    options.url = `${options.protocol}//${options.hostname}${options.path}`
    return operationMock.execute(options)
  }

  static setRequest(request) {
    this._request = request
  }

  static clearRequest() {
    this._request = null
  }

  static getRequest() {
    return this._request
  }

  static hasDependency(operationId, dependencyOperation) {
    return (this.dependencies[operationId] && _.includes(this.dependencies[operationId], dependencyOperation))
  }
}

module.exports = ApiClient
