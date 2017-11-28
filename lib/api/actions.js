'use strict'

const _ = require('lodash')

const json2csv = require('json2csv')
const statuses = require('statuses')
const errors   = require('./errors')

class Base {
  constructor(modelName) {
    this.modelName     = modelName
    this.successStatus = 'OK'
    this.errorStatus   = 'Internal Server Error'
  }

  initialize() {
    return null
  }

  before() {
    return null
  }

  action() {
    return null
  }

  after() {
    return null
  }

  response() {
    if (this.object) {
      if (this.object.toResponse) {
        return this.object.toResponse()
      }

      return this.object
    }

    return _.map(this.objects, object => object.toResponse())
  }

  success() {
    if (this.req.timedout) {
      log.error('Request timedout, response is not sent')
      return
    }

    const status = statuses(this.successStatus)

    if (status === '204') {
      return this.res.set('Content-Type', 'application/json').status(status).end()
    }

    const response = this.response()

    this.res.status(status).json(response)
  }

  error(error) {
    log.error(error)

    if (this.req.timedout) {
      log.error('Request timedout, response is not sent')
      return
    }

    let status = _.get(error, 'httpStatusCode', this.errorStatus)

    if (_.isString(status)) {
      status = statuses(status)
    }

    const response = _.pick(error, [ 'name', 'message', 'stack', 'errors' ])
    this.res.status(status).json(response)
  }

  exec(req, res) {
    this.req = req
    this.res = res

    return Promise.resolve()
      .then(() => this.initialize())
      .then(() => this.before())
      .then(() => this.action())
      .then(() => this.after())
      .then(() => this.success())
      .catch(error => this.error(error))
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

  action() {
    const model = Model(this.modelName)

    this.buildSearchQuery()

    const databaseCountQuery = model.count(this.query)
    const databaseFindQuery  = model
      .find(this.query).sort(this.sortBy)
      .skip(this.perPage * (this.page - 1)).limit(this.perPage)

    return Promise.resolve()
      .then(() => databaseCountQuery)
      .then(count => this.setHeaders(count))
      .then(() => databaseFindQuery)
      .then(results => this.objects = results)
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
    const data = _.map(this.objects, object => object.toResponse())
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
    const { id: integerId } = this.req.swaggerParameters
    this.query = { integerId }
  }

  action() {
    const model = Model(this.modelName)

    return model.findOne(this.query).exec()
      .then(object => {
        if (!object) {
          throw new errors.DocumentNotFoundError(this.modelName, this.query)
        }

        this.object = object
      })
  }
}

class Update extends Base {
  initialize() {
    const { id: integerId } = this.req.swaggerParameters
    this.query      = { integerId }
    this.parameters = this.req.body
  }

  action() {
    const model = Model(this.modelName)

    return model.findOneAndUpdate(this.query, this.parameters, { new: true }).exec()
      .then(object => {
        if (!object) {
          throw new errors.DocumentNotFoundError(this.modelName, this.query)
        }

        this.object = object
      })
  }
}

class Delete extends Base {
  initialize() {
    this.successStatus = 'No Content'
    this.errorStatus   = 'Unprocessable Entity'

    const { id: integerId } = this.req.swaggerParameters
    this.query = { integerId }
  }

  action() {
    const model = Model(this.modelName)

    return model.deleteMany(this.query)
  }
}

module.exports = { Base, Index, Export, Create, Read, Update, Delete }
