'use strict'

const fs       = require('fs')
const yaml     = require('js-yaml')
const rootPath = process.cwd()
const yamlPath = `${rootPath}/src/api/swagger.yaml`
const jsonPath = `${rootPath}/src/api/swagger.json`
const oasMiddleware = require('swagger-express-mw')

const defaultSwaggerHandler = (req, res) => res.sendFile(jsonPath)

const buildSpec = ({ host, port }) => {
  const yml  = fs.readFileSync(yamlPath, 'utf8')
  const spec = yaml.safeLoad(yml)
  spec.host  = `${host}:${port}`

  const json = JSON.stringify(spec, null, '  ')
  fs.writeFileSync(jsonPath, json)

  return spec
}

module.exports = (server, callback) => {
  const isEnabled = fs.existsSync(yamlPath)

  if (!isEnabled) {
    log.info(`[api] No specification found at ${yamlPath}`)
    callback()
  }

  const config = server.get('config')
  const { host, port } = config.server
  const { swaggerHandler, securityHandlers } = config.service

  if (!securityHandlers) {
    log.warn('`service.securityHandlers` hash is not defined.')
  }

  const oasYaml   = fs.readFileSync(`${__dirname}/config.yaml`, 'utf8')
  let   oasConfig = yaml.safeLoad(oasYaml)

  oasConfig = oasConfig.swagger
  oasConfig.appRoot          = `${rootPath}`
  oasConfig.swagger          = buildSpec({ host, port })
  oasConfig.fittingsDirs     = [ __dirname ]
  oasConfig.securityHandlers = securityHandlers || {}

  server.get('/swagger', swaggerHandler || defaultSwaggerHandler)

  oasMiddleware.create(oasConfig, (error, middleware) => {
    if (error) {
      throw error
    }

    middleware.register(server)
    log.debug('[oas] middleware registered')

    callback()
  })
}
