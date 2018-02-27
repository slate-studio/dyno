'use strict'

const config = require('config')
const os     = require("os")

const generateRequestCounter = () => {
  if (!global['redis']) {
    throw new Error('Redis has to be initialized, `global.redis` is not defined')
  }
  const serviceName = config.service.name
  const counterName = `${serviceName}RequestCounter`
  return redis.incrAsync(counterName)
}

const buildRequestId = (sourceRequestId, requestCounter) => {
  return `${sourceRequestId}:${requestCounter}`
}

const getInstanceId = () => {
  return os.hostname()
}

module.exports = {
  generateRequestCounter,
  buildRequestId,
  getInstanceId
}