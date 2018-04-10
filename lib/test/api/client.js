'use strict'

const _             = require('lodash')
const statuses      = require('statuses')
const expect        = require('chai').expect
const config        = require('../../config')
const rootPath      = process.cwd()
const SwaggerClient = require('swagger-client')
const Validator     = require('../../api/client/validator')

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

class Request {
  constructor(apiClient, swaggerClient, options) {
    this.options        = options
    this.apiClient      = apiClient
    this.swaggerClient  = swaggerClient
    this.operationId    = options.operationId
    this.response       = null
    this.operationMocks = {}
  }

  getOperationId() {
    return this.operationId
  }

  execute(parameters = {}, options = { headers: {} }) {
    const requestInterceptor = req => {
      const headers = Object.assign({}, this.options.headers, options.headers)
      Object.assign(req.headers, headers)
      return req
    }

    const params = {
      parameters,
      requestInterceptor,
      operationId: this.operationId,
      securities:  { authorized: this.options.securities }
    }

    this.executeAsync = async() => {
      try {
        this.response = await this.swaggerClient.execute(params)

      } catch (error) {
        if (error.response) {
          this.response = error.response

        } else {
          throw error

        }
      }
    }

    const expect = new Expect(this)

    this.executePromise = this.executeAsync()

    this.executePromise.then(() => {
      this.apiClient.clearCurrentRequest(this.operationId)
    })

    return expect
  }

  waitForResponse() {
    return this.executePromise
  }

  addOperationMock(operationMock) {
    this.apiClient.verifyDependency(this.operationId, operationMock)

    const responseStatus = operationMock.getResponseStatus()
    const responseBody   = operationMock.getResponseBody()
    const serviceName    = operationMock.getServiceName()
    const operationId    = operationMock.getOperationId()
    const destination    = operationMock.getDestination()
    const operationSpec  = this.apiClient.getOperationSpec(serviceName, operationId)
    const validator      = new Validator(operationSpec)
    validator.validateResponseStatus(responseStatus, operationId)
    validator.validateResponseBody(responseStatus, responseBody, operationId)

    if (!this.operationMocks[destination]) {
      this.operationMocks[destination] = []
    }

    this.operationMocks[destination].push(operationMock)

    return this
  }

  getOperationMock(destination) {
    const operationMocks = this.operationMocks[destination]
    if (operationMocks) {
      for (let operationMock of operationMocks) {
        if (operationMock.isDone === false) {
          return operationMock
        }
      }
    }

    return null
  }

  getOperationMocks() {
    return this.operationMocks
  }
}

class Expect {
  constructor(request) {
    this.request = request
    this.delay   = 0
  }

  setDelay(delay) {
    this.delay = delay
    return this
  }

  async endureDelay() {
    if (this.delay) {
      return new Promise(resolve => setTimeout(resolve, this.delay))
    }
  }

  async expect({ status = null, body = null }, done) {
    await this.request.waitForResponse()

    await this.endureDelay()

    try {
      this.verifyMocksExecution()
      this.verifyResponseStatus(status)
      this.verifyResponseBody(body)

      if (done) {
        return done()
      }

      return this.request.response

    } catch (error) {
      if (done) {
        return done(error)
      }

      throw error

    }
  }

  verifyResponseStatus(status) {
    if (status) {
      const response = this.request.response
      expect(status).to.equal(response.status)
    }
  }

  verifyResponseBody(expectBody) {
    if (expectBody) {
      const response = this.request.response

      const compare = (responseData, expectData) => {
        for (let name in expectData) {
          const responseValue = responseData[name]
          const expectValue   = expectData[name]

          switch (true) {
            case _.isObject(expectValue):
              expect(_.isObject(responseValue)).to.be.true
              compare(responseValue, expectValue)
              break

            case _.isArray(expectValue):
              expect(_.isArray(responseValue)).to.be.true
              expect(responseValue).to.deep.include(expectValue)
              break

            default:
              expect(responseValue).to.equal(expectValue)
              break
          }
        }
      }

      compare(response.body, expectBody)
    }
  }

  verifyMocksExecution() {
    const operationMocks = this.request.getOperationMocks()
    for (let destination in operationMocks) {
      const operationMockByDestination = operationMocks[destination]

      for (let operationMock of operationMockByDestination) {
        operationMock.done()
      }
    }
  }
}

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

            if (_.includes(['date', 'date-time'], format)) {
              requestValue = validator.getStringDate(requestValue, format)
              mockValue    = validator.getStringDate(mockValue, format)
            }

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
