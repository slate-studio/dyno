'use strict'

const _        = require('lodash')
const rootPath = process.cwd()

const timeout              = require('connect-timeout')
const responseTime         = require('response-time')
const requestNamespace     = require('../middleware/requestNamespace')()
const paramsParser         = require('swagger-node-runner/fittings/swagger_params_parser')()
const sourceOperationId    = require('../middleware/sourceOperationId')()
const securityHandlers     = require('../middleware/securityHandlers')
const validator            = require('swagger-node-runner/fittings/swagger_validator')()
const expressCompatibility = require('swagger-node-runner/fittings/express_compatibility')()
const requestParameters    = require('../middleware/requestParameters')()
const swaggerSecurity      = require('swagger-node-runner/fittings/swagger_security')
const router               = require('../middleware/router')

const SwaggerApi = require('sway')

// TODO: Typo
class Meddleware {

  constructor() {
    this.middlewareConfig = {
      swaggerNodeRunner: {
        config: {
          securityHandlers,
          swagger: { appRoot: rootPath }
        },
        securityHandlers
      },
      controllersDirs: [ 'src/api' ],
      mockControllersDirs: [ 'src/mocks' ]
    }
  }

  async initialize() {
    const definition = `${rootPath}/src/api/swagger.yaml`
    this.api         = await SwaggerApi.create({ definition })
  }

  async execRequestMiddleware(request, response) {
    const appConfig      = request.app.get('config')
    const requestTimeout = _.get(appConfig, 'server.requestTimeout', 15000)

    requestNamespace({ request, response }, async (err) => {
      try {
        if (err) {
          throw err
        }

        await this._execExpressMiddleware(request, response, responseTime())
        await this._execExpressMiddleware(request, response, timeout(requestTimeout))
        await this._execSwaggerMiddleware({ request, response }, paramsParser)
        await this._execSwaggerMiddleware({ request, response }, sourceOperationId)

        const security = swaggerSecurity({}, { config: this.middlewareConfig })
        // await this._execSwaggerMiddleware({ request, response }, security)

        await this._execSwaggerMiddleware({ request, response }, validator)
        await this._execSwaggerMiddleware({ request, response }, expressCompatibility)
        await this._execSwaggerMiddleware({ request, response }, requestParameters)

        const config  = _.cloneDeep(this.middlewareConfig)
        config.swaggerNodeRunner.api = this.api

        const _router = router(config, { config })
        await this._execSwaggerMiddleware({ request, response }, _router)

      } catch(error) {
        this._errorHandler(error, request, response)
      }
    })
  }

  _execExpressMiddleware(request, response, middleware) {
    return this._execMiddleware(middleware.bind(null, request, response), request, response)
  }

  _execSwaggerMiddleware(context, middleware) {
    const { request, response } = context
    return this._execMiddleware(middleware.bind(null, context), request, response)
  }

  _execMiddleware(middleware, request, response) {
    return new Promise(next => {
      middleware(error => {
        if (error) {
          return this._errorHandler(error, request, response)
        }

        return next()
      })
    })
  }

  _errorHandler(error, request, response) {
    const statusCode = error.statusCode || 500
    const object     = _.pick(error, [ 'name', 'message', 'stack', 'errors' ])
    response.status(statusCode).json(object)

    log.error('[redis server] Error:', error)
  }
}

exports = module.exports = Meddleware
