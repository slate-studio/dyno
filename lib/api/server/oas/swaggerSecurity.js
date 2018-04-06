'use strict'

const _     = require('lodash')
const path  = require('path')
const debug = require('debug')('swagger:swaggerSecurity')
const async = require('async')
const helpers = require('swagger-node-runner/lib/helpers')

function getScopeOrAPIKey(req, securityDefinition, name, securityRequirement) {
  let scopeOrKey

  if (securityDefinition.type === 'oauth2') {
    scopeOrKey = securityRequirement[name]

  } else if (securityDefinition.type === 'apiKey') {
    if (securityDefinition.in === 'query') {
      scopeOrKey = helpers.queryString(req)[securityDefinition.name]

    } else if (securityDefinition.in === 'header') {
      const headerName = securityDefinition.name.toLowerCase()
      scopeOrKey = req.headers[headerName]

    }
  }

  return scopeOrKey
}

const legacyHandler = (handler, req, securityDefinition, scopeOrKey) => {
  return new Promise(resolve => handler(req, securityDefinition, scopeOrKey, resolve))
}

const checkSecurityRequirement = async(req, operation, handlers, securityRequirement) => {
  for (const name in securityRequirement) {
    const securityDefinition = operation.securityDefinitions[name]
    const handler = handlers[name]

    if (!handler) {
      return new Error(`Unknown security handler: ${name}`)
    }

    const scopeOrKey = getScopeOrAPIKey(req, securityDefinition, name, securityRequirement)
    const error = await legacyHandler(handler, req, securityDefinition, scopeOrKey)

    if (error) {
      return error
    }
  }
}

module.exports = function create(fittingDef, bagpipes) {
  const runner = bagpipes.config.swaggerNodeRunner

  return async function swaggerSecurity(context, next) {
    const handlers  = runner.securityHandlers || {}
    const req       = context.request
    const operation = req.swagger.operation

    if (!operation) {
      return next()
    }

    const security = operation.getSecurity()

    if (!security || security.length == 0) {
      return next()
    }

    const orErrors = []
    for (const securityRequirement of security) {
      const error = await checkSecurityRequirement(req, operation, handlers, securityRequirement)

      if (!error) {
        return next()
      }

      orErrors.push(error)
    }

    return next(orErrors[0])
  }
}
