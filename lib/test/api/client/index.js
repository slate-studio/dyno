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
    this.request         = null
    this.operationsSpecs = {}
    this.Request         = Request
    this.OperationMock   = OperationMock
    this.spec            = require(`${rootPath}/src/api/swagger.json`)

    const services = this.options.appApiClient.services
    const specs    = _.map(services, service => {
      return { name: service.name, spec: service.client.spec }
    })
    this.OperationMock.setOperationsSpecs(specs)

    config.client.http.execute = async(options) => {
      const jsonParameters      = JSON.stringify(options.requestParameters)
      options.requestParameters = JSON.parse(jsonParameters)

      const { requestOperationId, serviceName, requestParameters } = options

      const operationSpec = this.OperationMock.getOperationSpec(serviceName, requestOperationId)

      const validator = new Validator(operationSpec)
      validator.validateParameters(requestParameters)

      const operationMock = this.request.getOperationMock(
        serviceName,
        requestOperationId,
        requestParameters
      )

      if (!operationMock) {
        throw new Error(`Mock not found for: ${serviceName}.${requestOperationId}`)
      }

      options.url = `${options.protocol}//${options.hostname}${options.path}`
      return operationMock.execute(options)
    }
  }

  async initialize() {
    this.swaggerClient = await SwaggerClient({ spec: this.spec })

    for (let path in this.swaggerClient.spec.paths) {
      const methods = this.swaggerClient.spec.paths[path]

      for (let method in methods) {
        const operation   = methods[method]
        const operationId = operation.operationId

        if (operationId) {
          const options = Object.assign({ operationId }, this.options)
          this[operationId] = () => {
            if (this.request) {
              throw new Error('Can\'t create request because previous request has not already finished')
            }

            this.request = new Request(this, this.swaggerClient, options)
            return this.request
          }

          const dependency = operation['x-dependency-operation-ids'] || []
          this.dependencies[operationId] = dependency
          this.operationsSpecs[operationId] = operation
        }
      }
    }
  }

  getRequest() {
    return this.request
  }

  hasDependency(operationId, dependencyOperation) {
    return (this.dependencies[operationId] && _.includes(this.dependencies[operationId], dependencyOperation))
  }
}

module.exports = ApiClient
