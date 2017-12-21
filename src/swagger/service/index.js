'use strict'

const _ = require('lodash')
const RequestNamespace = require('../../../lib/requestNamespace')
// const cls           = require('continuation-local-storage')
// const namespace     = cls.getNamespace('requestNamespace')
const nock          = require('nock')
const SwaggerClient = require('swagger-client')
const mock          = require('./mock')
const EventEmitter  = require('events')
const http          = require('./request/http')

const IS_TEST_ENVIRONMENT = [ 'test', 'gitlab' ].indexOf(process.env.NODE_ENV) > -1
const CONNECTION_ERRORS   = [ 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED' ]

const isConnectionError = code => CONNECTION_ERRORS.indexOf(code) > -1
const requestTimeout    = () => IS_TEST_ENVIRONMENT ? 0.1 : 2

const request = (...args) => {
  const service     = args[0]
  const operationId = args[1]
  const parameters  = args[2]
  const resolve     = args[3]
  const reject      = args[4]

  const addRequestHeaders = req => {
    const namespace = new RequestNamespace()
    const authenticationToken = namespace.get('authenticationToken')
    const requestId           = namespace.get('requestId')
    const sourceOperationId   = namespace.get('sourceOperationId')

    if (authenticationToken) {
      req.headers['x-authentication-token'] = authenticationToken
    }

    if (requestId) {
      req.headers['x-request-id'] = requestId
    }

    if (sourceOperationId) {
      req.headers['x-original-operation-id'] = sourceOperationId
    }

    req.serviceName = service.name
    req.operationId = operationId

    return req
  }

  const params = {
    http:               http,
    operationId:        operationId,
    parameters:         parameters,
    requestInterceptor: addRequestHeaders
  }

  service.client.execute(params)
    .then(resolve)
    .catch((err) => {
      const errCode = err.code

      // // TODO: Limit number of retries.
      // if (isConnectionError(errCode)) {
      //   const timeout = requestTimeout()

      //   log.error(`Services.${service.name}.${operationId}`, parameters, errCode)
      //   log.info(`Retry Service.${service.name}.${operationId} in ${timeout}s`)

      //   return setTimeout(() => { request(...args) }, timeout * 1000)

      // }

      log.error(err)
      reject(err)
    })
}

class Service extends EventEmitter {
  constructor(name, spec) {
    super()
    this.client = null
    this.name   = name

    SwaggerClient({ spec: spec })
      .then(client => {
        this.client = client
        this.emit('ready')
      })

    this.execute = (operationId, params={}) => {
      log.info(`Services.${name}.${operationId}`, params)

      return new Promise((resolve, reject) => {
        request(this.client, operationId, params, resolve, reject)
      })
    }

    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        const operationId = operation.operationId

        this[operationId] = (params={}) => {
          log.info(`Services.${name}.${operationId}`, params)

          return new Promise((resolve, reject) => {
            const onSuccess = (success) => resolve(success.obj)
            request(this, operationId, params, onSuccess, reject)
          })
        }
      })
    })

    if (IS_TEST_ENVIRONMENT) {
      this.mock = mock(spec)
    }

  }
}

module.exports = Service
