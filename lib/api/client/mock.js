'use strict'

const _     = require('lodash')
const fs    = require('fs')
const yaml  = require('js-yaml')
const http  = require('http')
const nock  = require('nock')
const SwaggerClient = require('swagger-client')

const services     = {}
const dependencies = {}

const rootPath = process.cwd()
const yamlPath = `${rootPath}/src/api/swagger.yaml`

if (fs.existsSync(yamlPath)) {
  const yml  = fs.readFileSync(yamlPath, 'utf8')
  const spec = yaml.safeLoad(yml)

  if (spec.paths) {
    _.forEach(spec.paths, methods => {
      _.forEach(methods, operation => {
        if (operation.operationId) {
          const dependency = operation['x-dependency-operation-ids'] || []
          dependencies[operation.operationId] = dependency
        }
      })
    })
  }
}

class Mock {
  constructor(baseOperationId) {
    this.baseOperationId = baseOperationId
  }

  setMock(destination, parameters, response = {}) {
    // TODO: buildRequest requires all required parameters to be present, that
    //       means for update request we need to specify empty {} body param.

    const [serviceName, operationId] = destination.split('.')
    const spec = services[serviceName]

    if (!spec) {
      log.debug(`Service '${serviceName}' doesn't exists`)
      return
    }

    if (this.baseOperationId && !_.includes(dependencies[this.baseOperationId], operationId)) {
      const message = `OPERATION_ID '${operationId}'  DOESN'T EXISTS IN THE '${this.baseOperationId}' DEPENDENCIES`
      throw new Error(message)
    }

    const host    = `http://${spec.host}`
    const request = SwaggerClient.buildRequest({ spec, operationId, parameters })

    const method = request.method.toLowerCase()
    const path   = _.replace(request.url, host, '')

    if (_.isEmpty(response)) {
      response = this._defaultSuccessResponseFor(spec, operationId)
    }

    return nock(host)[method](path).reply(response.status, response.object)
  }


  _defaultSuccessResponseFor(spec, operationId) {
    const operation = this._findOperation(spec, operationId)
    const responses = operation.responses
    const status    = this._successResponseStatus(responses)
    const object    = {}

    return { status: status, object: object }
  }

  _successResponseStatus(responses) {
    const successCodes = _.keys(http.STATUS_CODES)
    const codes = _.keys(responses)

    return _.intersection(successCodes, codes)[0] || 200
  }

  _findOperation(spec, operationId) {
    _.forEach(spec.paths, methods => {
      _.forEach(methods, operation => {
        if (operation.operationId == operationId) {
          return operation
        }
      })
    })

    return
  }
}

exports = module.exports = (serviceName, spec) => services[serviceName] = spec
exports.Mock = Mock
