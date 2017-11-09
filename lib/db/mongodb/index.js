'use strict'

const _ = require('lodash')

const plugins = require('./plugins')
const RequestNamespace  = require('../../requestNamespace')
const reconnectInterval = 500


class SchemaNotFound extends Error {
  constructor(modelName) {
    super(`Schema for '${modelName}' is not found`)
    this.name = this.constructor.name
  }
}

class Mongodb {
  constructor({ uri, collectionName }) {
    this.uri            = uri
    this.collectionName = collectionName
    this.schemas        = {}
    this.models         = {}

    this.options = {
      useMongoClient: true,
      keepAlive:      1,
      reconnectTries: Number.MAX_VALUE,
      autoReconnect:  true,
      reconnectInterval
    }

    this.mongoose = require('mongoose')
    this.mongoose.Promise = global.Promise

    this.mongoose.plugin(plugins.simulateUnhandledError)
    this.mongoose.plugin(plugins.neverDelete)
    this.mongoose.plugin(plugins.timestamp)
    this.mongoose.plugin(plugins.userstamp, { requestNamespaceKey: 'userId' })
    this.mongoose.plugin(plugins.export)
    this.mongoose.plugin(plugins.responsable)
    this.mongoose.plugin(plugins.insert)

    this.globals = {
      Model:  (...args) => this.Model.call(this, ...args),
      Schema: (...args) => this.Schema.call(this, ...args)
    }
  }

  Schema({ model, schema: fields, collection }) {
    const schema = new this.mongoose.Schema(fields)

    // NOTE: Dynamic collectionName method is only used when collection name
    //       is manually specified in Schema definition.
    if (this.collectionName && collection) {
      schema.getDynamicCollectionName = this.collectionName(collection)
      schema.hasDynamicCollectionName = true
    }

    schema.plugin(plugins.autoIncrement, { model, mongoose: this.mongoose })

    return schema
  }

  Model(modelName, customNamespace) {
    const schema = this.getSchema(modelName)

    if (schema.hasDynamicCollectionName) {
      const requestNamespace = new RequestNamespace(customNamespace)
      modelName = schema.getDynamicCollectionName(modelName, requestNamespace)
    }

    let model = this.models[modelName]

    if (model) {
      return model
    }

    const collectionName =
      (schema.hasDynamicCollectionName ? modelName : null)

    model = this.mongoose.model(modelName, schema, collectionName)
    this.models[modelName] = model

    return model
  }

  getSchema(modelName) {
    let schema = this.schemas[modelName]

    if (schema) {
      return schema
    }

    const rootPath   = process.cwd()
    const moduleName = _.camelCase(modelName)

    try {
      schema = require(`${rootPath}/src/models/${moduleName}`)

    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        throw new SchemaNotFound(modelName)
      }

      throw e
    }

    this.schemas[modelName] = schema
    return schema
  }

  connect() {
    return this.mongoose.connect(this.uri, this.options)
      .then(connection => {
        log.info('[database] Mongodb connected to', this.uri)
        this.connection = connection
        this.setDebug()
      })
  }

  setDebug() {
    const IGNORE_METHODS = [
      'createIndex', 'drop'
    ]

    this.mongoose.set('debug', (collection, method, query, options) => {
      this.connection.db.collection(collection)
        .find(query).explain((err, explaination) => {
          const path  = 'queryPlanner.winningPlan.inputStage.indexName'
          const index = _.get(explaination, path, null)

          if (!_.includes(IGNORE_METHODS, method)) {
            if (_.isEmpty(query)) {
              const msg = '[mongodb]: Query is empty, potentially slow operation\n'
              log.warn(msg, { collection, method, query, options, index })
              return
            }

            if (index === null) {
              const msg = '[mongodb]: Query has no index\n'
              log.warn(msg, { collection, method, query, options })
              return
            }
          }

          log.info('[mongodb]:\n', { collection, method, query, options, index })
        })
    })
  }

  closeConnection() {
    return new Promise(resolve => {
      setTimeout(() => this.connection.close().then(resolve), 2000)
    })
  }
}

exports = module.exports = config => {
  if (!global['log']) {
    throw new Error('Logger has to be initialized, `global.log` is not defined')
  }

  const mongodb = new Mongodb(config)

  return mongodb.connect()
    .then(() => mongodb)
}

exports.Mongodb = Mongodb
exports.seed    = require('./seed')

