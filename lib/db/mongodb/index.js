'use strict'

const _ = require('lodash')

const plugins = require('./plugins')
const RequestNamespace = require('../../requestNamespace')
const BluebirdPromise  = require('bluebird')

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
      keepAlive:         1,
      autoReconnect:     true,
      reconnectTries:    Number.MAX_VALUE,
      reconnectInterval: 500,
      promiseLibrary:    BluebirdPromise,
      poolSize:          20
    }

    this.mongoose = require('mongoose')
    this.mongoose.Promise = global.Promise

    this.mongoose.plugin(plugins.simulateUnhandledError)
    this.mongoose.plugin(plugins.createOnce)
    this.mongoose.plugin(plugins.createOrUpdate)
    this.mongoose.plugin(plugins.neverDelete)
    this.mongoose.plugin(plugins.userstamp, { requestNamespaceKey: 'userId' })
    this.mongoose.plugin(plugins.export)
    this.mongoose.plugin(plugins.responsable)
    this.mongoose.plugin(plugins.insert)

    this.globals = {
      Model:  (...args) => this.Model.call(this, ...args),
      Schema: (...args) => this.Schema.call(this, ...args)
    }
  }

  Schema({ model, schema: fields, collection, options }) {
    options = options || {}
    options.versionKey = '_v'
    options.timestamps = true

    const schema = new this.mongoose.Schema(fields, options)

    // NOTE: Dynamic collectionName method is only used when collection name
    //       is manually specified in Schema definition.
    if (this.collectionName && collection) {
      schema.getDynamicCollectionName = this.collectionName(collection)
      schema.hasDynamicCollectionName = true
    }

    schema.plugin(plugins.autoIncrement, { model, mongoose: this.mongoose })
    schema.set('toObject', { getters: true })
    schema.collection = collection

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

    let collectionName = (schema.hasDynamicCollectionName ? modelName : null)
    collectionName     = (collectionName ? collectionName : schema.collection)

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

  async connect() {
    await this.mongoose.connect(this.uri, this.options)
    log.info('[mongodb] Connected to', this.uri)

    this.mongoose.set('debug', false)
    this.setDebug()
  }

  setDebug() {
    const IGNORE_METHODS = [
      'createIndex', 'drop'
    ]

    this.mongoose.set('debug', (collection, method, query, options) => {
      const requestNamespace = new RequestNamespace()
      const namespace        = requestNamespace.getAll()

      this.mongoose.connection.db.collection(collection)
        .find(query).explain((err, explaination) => {
          const requestNamespace = new RequestNamespace(namespace)
          requestNamespace.save([], () => {
            const path  = 'queryPlanner.winningPlan.inputStage.indexName'
            const index = _.get(explaination, path, null)

            if (!_.includes(IGNORE_METHODS, method)) {
              if (_.isEmpty(query)) {
                const msg = '[mongodb] Query is empty, potentially slow operation'
                log.warn({ collection, method, query, options, index }, msg)
                return
              }

              if (index === null) {
                const msg = '[mongodb] Query has no index'
                log.warn({ collection, method, query, options }, msg)
                return
              }
            }

            log.debug({ collection, method, query, options, index }, `[mongodb] ${collection}.${method}`)
          })
        })
    })
  }

  closeConnection() {
    return new Promise(resolve => {
      setTimeout(() => this.mongoose.connection.close().then(resolve), 2000)
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
exports.seed = require('./seed')

