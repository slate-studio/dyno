'use strict'

const _        = require('lodash')
const expect   = require('chai').expect
const Mocker   = require('../../api/client/mock').Mock
const rootPath = process.cwd()
const SwaggerClient = require('swagger-client')

class OperationMock {
  constructor(operationId) {
    this.operationId    = operationId
    this.parameters     = null
    this.responseStatus = 200
    this.responseBody   = null
  }

  getOperationId() {
    return this.operationId
  }

  setMock(mock) {
    this.mock = mock
  }

  getMock() {
    return this.mock
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
  constructor(client, options) {
    this.options        = options
    this.client         = client
    this.operationId    = options.operationId
    this.response       = null
    this.mocker         = new Mocker(this.operationId)
    this.operationMocks = []
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
        this.response = await this.client.execute(params)

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

    return expect
  }

  waitForResponse() {
    return this.executePromise
  }

  addOperationMock(operationMock) {
    const operationId    = operationMock.getOperationId()
    const parameters     = operationMock.getParameters()
    const responseStatus = operationMock.getResponseStatus()
    const responseBody   = operationMock.getResponseBody()

    const mock = this.mocker.setMock(
      operationId,
      parameters,
      { status: responseStatus, object: responseBody }
    )

    operationMock.setMock(mock)
    this.operationMocks.push(operationMock)

    return this
  }

  getOperationMocks() {
    return this.operationMocks
  }
}

class Expect {
  constructor(request) {
    this.request = request
  }

  async expect({ status = null, body = null }, done) {
    await this.request.waitForResponse()

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

    operationMocks.forEach(operationMock => {
      const mock = operationMock.getMock()
      mock.done()
    })
  }
}

class ApiClient {
  constructor(options = {}) {
    this.options       = options
    this.Request       = Request
    this.OperationMock = OperationMock

    this.spec = require(`${rootPath}/src/api/swagger.json`)
  }

  async initialize() {
    this.client = await SwaggerClient({ spec: this.spec })

    for (let path in this.spec.paths) {
      const methods = this.spec.paths[path]

      for (let method in methods) {
        const operationId = methods[method].operationId

        if (operationId) {
          const options = Object.assign({ operationId }, this.options)
          this[operationId] = () => new Request(this.client, options)
        }
      }
    }
  }
}

module.exports = ApiClient
