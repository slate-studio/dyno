'use strict'

const _         = require('lodash')
const Validator = require('../../../oas/validator')

class Expect {
  constructor(request) {
    this.request = request
    this.delay   = 0

    this.ApiClient = require('./index')
  }

  setDelay(delay) {
    this.delay = delay
    return this
  }

  async wait() {
    if (this.delay) {
      return new Promise(resolve => setTimeout(resolve, this.delay))
    }
  }

  async expect({ status = null, body = null }, done) {
    await this.request.waitForResponse()

    await this.wait()

    this.request.clear()

    try {
      this.verifyResponseStatus(status)
      this.verifyResponseBody(body)
      this.verifyMocksExecution()

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
      const operationId = this.request.operationId
      const response    = this.request.response

      expect(status).to.equal(response.status)

      const spec      = this.ApiClient.operationsSpecs[operationId]
      const validator = new Validator(spec)

      if (status == 500) {
        return
      }

      validator.validateResponseStatus(response.status, operationId)
    }
  }

  verifyResponseBody(expectBody) {
    if (expectBody) {
      const operationId = this.request.operationId
      const response    = this.request.response
      const spec        = this.ApiClient.operationsSpecs[operationId]
      const validator   = new Validator(spec)

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

      if (response.status != 500) {
        validator.validateResponseBody(response.status, response.body, operationId)
      }

      compare(response.body, expectBody)
    }
  }

  verifyMocksExecution() {
    const operationMocks = this.request.getOperationMocks()
    for (let destination in operationMocks) {
      const operationMockByDestination = operationMocks[destination]

      for (let operationMock of operationMockByDestination) {
        if (!operationMock.isDone()) {
          throw new Error(`Operation mock not yet satisfied: ${destination}`)
        }
      }
    }
  }
}

module.exports = Expect
