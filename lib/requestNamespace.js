'use strict'

global.Promise = require('bluebird')

const _   = require('lodash')
const cls = require('continuation-local-storage')

const NAMESPACE_NAME = 'requestNamespace'
const clsNamespace   = cls.createNamespace(NAMESPACE_NAME)
require('cls-bluebird')(clsNamespace)

class UndefinedNamespaceError extends Error {
  constructor() {
    super('Namespace is not defined')
    this.name = this.constructor.name
  }
}

class RequestNamespace {
  constructor(namespace) {
    if (namespace) {
      this.localNamespace = namespace

    } else {
      this.clsNamespace = cls.getNamespace(NAMESPACE_NAME)

    }
  }

  save(emitters = [], callback) {
    if (!this.localNamespace) {
      throw new UndefinedNamespaceError()
    }

    this.clsNamespace = cls.getNamespace('requestNamespace')

    _.forEach(emitters, emitter => this.clsNamespace.bindEmitter(emitter))

    this.clsNamespace.run(() => {
      _.forEach(this.localNamespace, (value, key) => this.clsNamespace.set(key, value))

      callback()
    })
  }

  set(key, value) {
    if (this.localNamespace) {
      this.localNamespace[key] = value
    }

    if (this.clsNamespace) {
      this.clsNamespace.set(key, value)
    }
  }

  get(key) {
    if (this.localNamespace) {
      return this.localNamespace[key]
    }

    return this.clsNamespace.get(key)
  }

  getAll() {
    if (this.localNamespace) {
      return this.localNamespace
    }

    return this.clsNamespace.active || {}
  }
}

module.exports = RequestNamespace
