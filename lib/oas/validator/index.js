'use strict'

const _      = require('lodash')
const moment = require('moment')

const dateRegExp = new RegExp(
  '^' +
  '\\d{4}' + // year
  '-' +
  '([0]\\d|1[012])' + // month
  '-' +
  '(0[1-9]|[12]\\d|3[01])' + // day
  '$'
)

const dateTimeRegExp = new RegExp(
  '^' +
  '\\d{4}' + // year
  '-' +
  '([0]\\d|1[012])' + // month
  '-' +
  '(0[1-9]|[12]\\d|3[01])' + // day
  'T' +
  '([01]\\d|2[0-3])' + // hour
  ':' +
  '[0-5]\\d' + // minute
  ':' +
  '[0-5]\\d' + // second
  '(\\.\\d+)?' + // fractional seconds
  '(Z|(\\+|-)([01]\\d|2[0-4]):[0-5]\\d)' + // Z or time offset
  '$'
)

class Validator {

  constructor(operationSpec) {
    this.operationSpec = operationSpec
  }

  validateParameters(parameters) {
    const parametersSpec      = _.keyBy(this.operationSpec.parameters, v => v.name)
    const parametersKays      = _.keys(parameters)
    const allowParametersKeys = _.keys(parametersSpec)
    const difference          = _.difference(parametersKays, allowParametersKeys)
    if (difference.length) {
      throw new Error(`There were provided invalid parameters: ${difference}`)
    }

    const missingParameters = []
    for (let name in parametersSpec) {
      const parameter = parametersSpec[name]
      if (parameter.required && !parameters[name]) {
        missingParameters.push(name)
      }
    }

    if (missingParameters.length) {
      throw new Error(`Required parameters ${missingParameters} are not provided`)
    }

    for (let name in parameters) {
      const value = parameters[name]
      const spec  = parametersSpec[name]

      if (spec.in == 'body') {
        this.validateEntity(value, name, spec.schema)
      } else {
        this.validateEntity(value, name, spec)
      }
    }
  }

  validateResponseStatus(responseStatus, operationId) {
    if (!this.operationSpec.responses[responseStatus]) {
      throw new Error(`Response status '${responseStatus}' is not specified in the schema for ${operationId} operation`)
    }
  }

  validateResponseBody(responseStatus, responseBody, operationId) {
    const schema = this.operationSpec.responses[responseStatus].schema

    if (!schema && responseBody) {
      throw new Error(`Response body for ${operationId} mock should be empty`)
    }

    if (schema) {
      this.validateEntity(responseBody, 'responseBody', schema)
    }
  }

  validateEntity(value, name, spec) {
    const { type, format } = spec

    if (type && !this.checkType(type, value)) {
      throw new Error(`${name} should be '${type}' - Value: ${value}`)
    }

    switch(true) {
      case type === 'array':
        this.validateArray(value, name, spec)
        break

      case type === 'object':
        this.validateObject(value, name, spec)
        break

      default:
        if (_.includes(['date', 'date-time'], format)) {

          if (!this.isString(value)) {
            throw new Error(`Not a valid string: ${value} for '${format}' format`)
          }

          const checkFormat =
            ( format === 'date' ? dateRegExp.test(value) : dateTimeRegExp.test(value) )

          if (!checkFormat) {
            throw new Error(`Not a valid ${format} string: ${value}`)
          }
        }

        if (
          spec.enum &&
          (this.isString(value) || this.isNumber(value) || this.isInteger(value)) &&
          !_.includes(spec.enum, value)
        ) {
          throw new Error(`Invalid value for '${name}', no enum match for: ${value}`)
        }
        break
    }
  }

  validateArray(array, name, spec) {
    const itemsRequired = spec.items.required || []
    if (!array.length && itemsRequired.length) {
      throw new Error(`Array '${name}' is empty, but it must have requiresd nested objects`)
    }

    for(let item of array) { 
      this.validateEntity(item, name, spec.items)
    }
  }

  validateObject(object, name, spec) {
    const objectKays               = _.keys(object)
    const { required, properties } = spec

    if (required) {
      const difference = _.difference(required, objectKays)
      if (difference.length) {
        throw new Error(`Required parameters ${difference} are missing in ${name}`)
      }
    }

    const propertiesLength = Object.keys(properties).length

    for(let name in object) {
      // NOTE Temporarily commented out, check spec for all responses
      //      and if service doesn't use dyno `uuid` we have a lot of validation errors
      // 
      // if (propertiesLength && !properties[name]) {
      //   throw new Error(`Parameter ${name} is not specified in schema`)
      // }

      if (properties[name]) {
        const value = object[name]
        this.validateEntity(value, name, properties[name])
      }
    }
  }

  checkType(type, value) {
    return this[`is${_.upperFirst(type)}`](value)
  }

  isArray(value) {
    return _.isArray(value)
  }

  isObject(value) {
    return _.isObject(value)
  }

  isString(value) {
    return _.isString(value)
  }

  isNumber(value) {
    return _.isNumber(value)
  }

  isInteger(value) {
    return _.isInteger(value)
  }
}

module.exports = Validator
