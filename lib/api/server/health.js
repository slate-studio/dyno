'use strict'

const _  = require('lodash')
const fs = require('fs')

const config  = require('config')
const router  = require('express').Router()
const cors    = require('cors')
const jsonRequest = require('../../jsonRequest')

const rootPath = process.cwd()
const specPath = `${rootPath}/src/api/swagger.json`
const pkg      = require(`${rootPath}/package.json`)
const version  = pkg.version
const path     = '/health'

const HEALTH_REQUEST_TIMEOUT = 1000

const checkService = config => {
  const spec              = require(`${rootPath}/${config.spec}`)
  const name              = config.name
  const localVersion      = spec.info.version
  const localVersionMajor = localVersion.split('.')[0]

  const host = config.host

  const options = {
    url:     `http://${host}/health`,
    timeout: HEALTH_REQUEST_TIMEOUT
  }

  return jsonRequest(options)
    .then(res => {
      const remoteVersion = res.object.apiVersion

      if (remoteVersion) {
        const remoteVersionMajor = remoteVersion.split('.')[0]

        if (localVersionMajor !== remoteVersionMajor) {
          const message = `Specification mismatch, expected: v${localVersion}, \
  returned: v${remoteVersion}`

          return { name: name, message: message }
        }
      }

      return null
    })
    .catch(error => {
      return { name: name, message: error.message }
    })
}

const health = async (req, res) => {
  const { services, service } = req.app.get('config')
  const checkDependencies     = (req.query.checkDependencies === 'true') ? true : false

  const response = {
    name:       service.name,
    version:    version,
    status:     'OK',
    errors:     []
  }

  if (fs.existsSync(specPath)) {
    const serviceSpec   = require(specPath)
    response.apiVersion = serviceSpec.info.version
  }

  if (config.mongodb) {
    const mongoose = require('mongoose')
    if (!mongoose.connection.readyState) {
      response.status = 'ERROR'
      response.errors.push({
        name: 'MongoDb check',
        errors: [{ message: 'MongoDb connection is not ready' }]
      })
    }
  }

  if (global.redis) {
    try {
      await global.redis.pingAsync()
      await new Promise(resolve => setTimeout(resolve, '5000'))
    } catch (error) {
      response.status = 'ERROR'
      response.errors.push({
        name: 'Redis check',
        errors: [{ code: error.code, message: error.message }]
      })
    }
  }

  if (checkDependencies && Object.keys(services).length) {
    const checks = _.map(services, checkService)

    return Promise.all(checks)
      .then(results => {
        response.errors = response.errors.concat(_.compact(results))

        if (response.errors.length > 0 ) {
          response.status = 'ERROR'
        }

        res.status(200).json(response)
      })
      .catch(error => {
        response.status = 'ERROR'
        response.errors = [ { code: error.code, message: error.message } ]

        res.status(200).json(response)
      })

  } else {
    return res.status(200).json(response)

  }
}

if (process.env.NODE_ENV == 'production') {
  router.get(path, health)

} else {
  router.get(path, cors(), health)

}

module.exports = router
