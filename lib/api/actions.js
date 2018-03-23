'use strict'

const _ = require('lodash')

const json2csv = require('json2csv')
const statuses = require('statuses')
const errors   = require('./errors')
const config   = require('config')
const Response = require('./response')
const RequestNamespace = require('../requestNamespace')

class Base {
  constructor(modelName) {
    this.modelName     = modelName
    this.successStatus = 'OK'
  }

  initialize() {
    return null
  }

  action() {
    return null
  }

  response() {
    const response = new Response(this.object || this.objects)
    return response.getData()
  }

  success() {
    const status = statuses(this.successStatus)

    if (status === '204') {
      return this.res.set('Content-Type', 'application/json').status(status).end()
    }

    const response = this.response()

    this.res.status(status).json(response)
  }

  error(error) {
    log.debug(error)

    let status = error.httpStatusCode

    if (!status) {
      error  = new errors.InternalServerError(error)
      status = error.httpStatusCode
      log.error(error)
    }

    if (_.isString(status)) {
      status = statuses(status)
    }

    const requestNamespace = new RequestNamespace()
    const normalizedError = {
      name:              error.name,
      message:           error.message,
      originalError:     error.originalError || {},
      serviceName:       config.service.name,
      requestId:         requestNamespace.get('requestId'),
      operationId:       requestNamespace.get('operationId'),
      sourceRequestId:   requestNamespace.get('sourceRequestId'),
      sourceOperationId: requestNamespace.get('sourceOperationId')
    }

    this.res.status(status).json(normalizedError)
  }

  async exec(req, res) {
    this.req = req
    this.res = res

    try {
      await this.initialize()

      if (this.before) { await this.before() }

      await this.action()

      if (this.after) { await this.after() }

      this.success()

    } catch (error) {
      this.error(error)

    }
  }
}

class Index extends Base {
  constructor(modelName, options = {}) {
    super(modelName)

    this.sortBy   = options.sortBy   || { createdAt: -1 }
    this.searchIn = options.searchIn || []
  }

  initialize() {
    this.page    = this.req.swaggerParameters.page    || 1
    this.perPage = this.req.swaggerParameters.perPage || 10
    this.search  = this.req.swaggerParameters.search

    this.query = {}
  }

  buildSearchQuery() {
    if (this.search && this.searchIn.length > 0) {
      this.query['$or'] = _.map(this.searchIn, fieldName => {
        const fieldQuery = {}
        fieldQuery[fieldName] = { $regex: new RegExp(this.search), $options: 'i' }

        return fieldQuery
      })
    }
  }

  async action() {
    const model = Model(this.modelName)

    this.buildSearchQuery()

    const databaseCountQuery = model.count(this.query)
    const databaseFindQuery  = model
      .find(this.query).sort(this.sortBy)
      .skip(this.perPage * (this.page - 1)).limit(this.perPage)

    const count = await databaseCountQuery
    this.setHeaders(count)

    this.objects = await databaseFindQuery
  }

  setHeaders(totalCount) {
    const pagesCount = Math.ceil(totalCount / this.perPage)

    const headers = {
      'X-Page':        this.page,
      'X-Per-Page':    this.perPage,
      'X-Pages-Count': pagesCount,
      'X-Total-Count': totalCount
    }

    _.forEach(headers, (value, header) => this.res.setHeader(header, value))

    if (pagesCount > this.page) {
      this.res.setHeader('X-Next-Page', this.page + 1)
    }
  }
}

class Export extends Index {
  constructor(modelName, fields) {
    super(modelName)

    this.fields   = fields
    this.filename = `${modelName}s.csv`
  }

  initialize() {
    this.page    = 1
    this.perPage = 99999
    this.query   = {}
  }

  response() {
    const response = new Response(this.objects)
    const data = response.getData()
    const csv  = json2csv({ data, fields: this.fields })

    return { filename: this.filename, content: csv }
  }
}

class Create extends Base {
  initialize() {
    this.successStatus = 'Created'
    this.errorStatus   = 'Unprocessable Entity'

    this.parameters = this.req.body
  }

  action() {
    const model = Model(this.modelName)
    this.object = new model(this.parameters)

    return this.object.save()
  }
}

class Read extends Base {
  initialize() {
    const { id: _id } = this.req.swaggerParameters
    this.query = { _id }
  }

  async action() {
    const model  = Model(this.modelName)
    const object = await model.findOne(this.query)

    if (!object) {
      throw new errors.DocumentNotFoundError(this.modelName, this.query)
    }

    this.object = object
  }
}

class Update extends Base {
  initialize() {
    const { id: _id } = this.req.swaggerParameters
    this.query      = { _id }
    this.parameters = this.req.body
  }

  async action() {
    const model  = Model(this.modelName)
    const object = await model.findOneAndUpdate(this.query, this.parameters, { new: true })

    if (!object) {
      throw new errors.DocumentNotFoundError(this.modelName, this.query)
    }

    this.object = object
  }
}

class Delete extends Base {
  initialize() {
    this.successStatus = 'No Content'
    this.errorStatus   = 'Unprocessable Entity'

    const { id: _id } = this.req.swaggerParameters
    this.query = { _id }
  }

  action() {
    const model = Model(this.modelName)
    return model.deleteMany(this.query)
  }
}

module.exports = { Base, Index, Export, Create, Read, Update, Delete }
