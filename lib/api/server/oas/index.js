'use strict'

const fs       = require('fs')
const yaml     = require('js-yaml')
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
    const { Authentication } = req.app

    if (!Authentication) {
      return callback()
    }

    const authentication = new Authentication(authenticationToken, req)
    return authentication.exec(callback)
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
