'use strict'

const _             = require('lodash')
const fs            = require('fs')
const yaml          = require('js-yaml')
const faker         = require('faker')
const nock          = require('nock')
const SwaggerClient = require('swagger-client')

const services      = {}
const dependencies  = {}

const rootPath      = process.cwd()
const yamlPath      = `${rootPath}/src/api/swagger.yaml`
const yml           = fs.readFileSync(yamlPath, 'utf8')
const spec          = yaml.safeLoad(yml)

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

const HTTP_SUCCESS_RESPONSES = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content'
}

class Mock {
  constructor(baseOperationId) {
    this.baseOperationId = baseOperationId
    const serviceSpec    = require(`${rootPath}/src/api/swagger.json`)
    this.baseOperationDependencies = serviceSpec.path
  }

  setMock(destination, params, response = {}) {
    // TODO: buildRequest requires all required parameters to be present, that
    //       means for update request we need to specify empty {} body param.

    const [serviceName, operationId] = destination.split('.')
    const spec = services[serviceName]

    if (!spec) {
      log.debug(`Service '${serviceName}' doesn't exists`)
      return
    }

    if (!_.includes(dependencies[this.baseOperationId], operationId)) {
      log.debug(`OPERATION_ID '${operationId}'  DOESN'T EXISTS IN THE '${this.baseOperationId}' DEPENDENCIES `)
    }

    const host    = `http://${spec.host}`
    const request = SwaggerClient.buildRequest({
      spec:        spec,
      operationId: operationId,
      parameters:  params
    })

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
    const schema    = responses[status].definition.properties
    const object    = this._fakeObject(schema)

    return { status: status, object: object }
  }

  _successResponseStatus(responses) {
    const successCodes = _.keys(HTTP_SUCCESS_RESPONSES)
    const codes = _.keys(responses)

    return _.intersection(successCodes, codes)[0] || 200
  }

  _findOperation(spec, operationId) {
    _.forEach(spec.paths, (methods, path) => {
      _.forEach(methods, (operation, method) => {
        if (operation.operationId == operationId) {
          return operation
        }
      })
    })

    return
  }

  _fakeObject(schema) {
    const result = {}

    _.forEach(schema, (def, name) => {
      let value

      if (def.hasOwnProperty('default')) {
        value = def.default

      } else if (def.hasOwnProperty('format')) {
        switch (def.format) {
          case 'uuid':
            value = faker.random.uuid()
            break

          case 'date-time':
          case 'date':
            value = faker.date.recent()
            break

          default:
            value = faker.lorem.word()
            break
        }
      } else {
        switch (def.type) {
          case 'integer':
            value = faker.random.number()
            break

          case 'boolean':
            value = true
            break

          case 'array':
            value = []
            break

          default:
            value = faker.lorem.word()
            break
        }
      }

      result[name] = value
    })

    return result
  }
}

exports = module.exports = (serviceName, spec) => services[serviceName] = spec
exports.Mock = Mock
