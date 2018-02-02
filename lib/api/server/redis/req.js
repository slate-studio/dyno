'use strict'

const _     = require('lodash')
const url   = require('url')
const EventEmitter = require('events')

class IncomingMessage extends EventEmitter {

  constructor({ operation, parameters, headers }) {
    super()
    const pathObject = operation.pathObject
    const path       = pathObject.api.basePath + pathObject.path

    this.complete = false,
    this.method   = _.toUpper(operation.method)
    this.url      = this._convertPattertToPath(path, parameters)
    this.body     = {}
    this.files    = {}
    this.query    = {}
    this.headers  = _.assign({ 'Content-Type': 'application/json' }, headers)

    this.statusCode    = null
    this.statusMessage = null,
    this.originalUrl   = this.url,
    this._parsedUrl    = url.parse(this.url)

    this._setParameters(operation, parameters)

    this.swagger = { operation }
  }

  get(name) {
    return this.header(name)
  }

  header(name) {
    if (typeof name !== 'string') {
      throw new TypeError('"name" argument must be a string')
    }

    const key = name.toLowerCase()
    return this.headers[key]
  }

  _setParameters(operation, parameters, headers) {
    const swaggerParameters = operation.getParameters()
    _.forEach(swaggerParameters, param => {
      const type = param.schema.type
      const name = param.name
      const _in  = param.in

      switch (_in) {
        case 'body':
          if (parameters[name]) {
            this.body = parameters[name]
          }
          break
        case 'formData':
          if (parameters[name]) {
            if (type === 'file') {
              this.files[name] = parameters[name]
            } else {
              this.body[name]  = parameters[name]
            }
          }
          break
        case 'query':
          if (parameters[name]) {
            this.query[name] = parameters[name]
          }
          break
      }
    })
  }

  _convertPattertToPath(pattert, parameters) {
    const regexp = new RegExp("{\\w+}", 'g')
    let match

    do {
      match = regexp.exec(pattert)
      if (match) {
        match   = match[0].replace(new RegExp("[{}]", 'g'), '')
        pattert = pattert.replace(`{${match}}`, parameters[match])
      }
    } while (match)

    return pattert
  }

}

exports = module.exports = IncomingMessage
