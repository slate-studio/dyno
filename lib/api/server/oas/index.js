'use strict'

const _             = require('lodash')
const fs            = require('fs')
const yaml          = require('js-yaml')
const serviceConfig = require('config')

const verifyAuthenticationToken = require('./verifyAuthenticationToken')
const { AuthenticationError, UnauthorizedOperationError } = require('../../errors')

const rootPath = process.cwd()
const yamlPath = `${rootPath}/api/swagger.yaml`
const jsonPath = `${rootPath}/api/swagger.json`

const buildSpec = ({ host, port }) => {
  const yml  = fs.readFileSync(yamlPath, 'utf8')
  const spec = yaml.safeLoad(yml)
  spec.host  = `${host}:${port}`

  const json = JSON.stringify(spec, null, '  ')
  fs.writeFileSync(jsonPath, json)

  return spec
}

module.exports = (server, { host, port }, callback) => {
  const isEnabled = fs.existsSync(yamlPath)

  if (!isEnabled) {
    log.info(`[api] No specification found at ${yamlPath}`)
    callback()
  }

  server.get('/swagger', (req, res) => res.sendFile(jsonPath))

  const swaggerMiddleware = require('swagger-express-mw')

  const spec       = buildSpec({ host, port })
  const configPath = `${__dirname}/config.yaml`
  let   config     = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'))

  config = config.swagger
  config.appRoot      = `${rootPath}`
  config.swagger      = spec
  config.fittingsDirs = [ __dirname ]

  const authenticationToken = (req, spec, authenticationToken, callback) => {
    const publicKey = req.app.get('publicKey')
    const isValid   = verifyAuthenticationToken(authenticationToken, publicKey)

    if (isValid) {
      const json   = new Buffer(authenticationToken, 'base64').toString()
      const object = JSON.parse(json)

      const operationId           = req.swagger.operation.operationId
      const availableOperationIds = object.operationIds || []

      if (availableOperationIds.indexOf(operationId) === -1) {
        return callback(new UnauthorizedOperationError())
      }

      const customAuthentication = _.get(serviceConfig, 'swagger.authentication', null)

      if (!_.isFunction(customAuthentication)) {
        log.warn('[authentication] Has not installed custom authentication function')
        callback()
      } else {
        return customAuthentication(req, object)
          .then(callback)
      }
    }

    return callback(new AuthenticationError())
  }

  config.securityHandlers = { authenticationToken }

  swaggerMiddleware.create(config, (error, middleware) => {
    if (error) {
      throw error
    }

    middleware.register(server)
    callback()
  })
}
