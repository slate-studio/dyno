'use strict'

const router = require('swagger-node-runner/fittings/swagger_router')
const path   = require('path')
const fs     = require('fs')

var SWAGGER_ROUTER_CONTROLLER = 'x-swagger-router-controller'

module.exports = function create(fittingDef, bagpipes) {
  router(fittingDef, bagpipes)

  const swaggerNodeRunner = bagpipes.config.swaggerNodeRunner
  const appRoot           = swaggerNodeRunner.config.swagger.appRoot
  const controllersDir    = path.resolve(appRoot, fittingDef.controllersDirs.pop())

  const operationIdsCache = {}

  return function swagger_router(context, cb) {
    const operation = context.request.swagger.operation
    const controllerName =
      operation[SWAGGER_ROUTER_CONTROLLER] || operation.pathObject[SWAGGER_ROUTER_CONTROLLER]

    const controllerPath = path.resolve(controllersDir, controllerName)

    if (!fs.existsSync(controllerPath)) {
      return cb(new Error('Controller directory not found'))
    }

    const operationId    = operation.definition.operationId
    const operationPath  = path.resolve(controllerPath, operationId)
    const OperationClass = require(operationPath)
    new OperationClass().exec(context.request, context.response)
        .then(() => cb())
  }
}
