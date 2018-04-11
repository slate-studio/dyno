'use strict'

const _      = require('lodash')
const Expect = require('./expect')

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
      this.apiClient.request = null
    })

    return expect
  }

  waitForResponse() {
    return this.executePromise
  }

  addOperationMock(operationMock) {
    const operationId   = operationMock.getOperationId()
    const destination   = operationMock.getDestination()
    const hasDependency = this.apiClient.hasDependency(this.operationId, operationId)

    if (!hasDependency) {
      const message = `Operation '${dependencyOperation}' doesn't exists in the '${operationId}' dependencies`
      throw new Error(message)
    }

    if (!this.operationMocks[destination]) {
      this.operationMocks[destination] = []
    }

    this.operationMocks[destination].push(operationMock)

    return this
  }

  getOperationMock(serviceName, operationId, requestParameters) {
    const destination    = `${serviceName}.${operationId}`
    const operationMocks = this.operationMocks[destination]

    if (operationMocks) {
      for (let operationMock of operationMocks) {
        if (
          !operationMock.isDone() &&
          (!operationMock.getParameters() || operationMock.isMatchOfParameters(requestParameters))
        ) {
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

module.exports = Request
