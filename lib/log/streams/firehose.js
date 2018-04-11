'use strict'

const _              = require('lodash')
const aws            = require('aws-sdk')
const bunyanFirehose = require('bunyan-firehose')

exports = module.exports = (level, config) => {
  const type = 'raw'

  const hasPriority = chunk => chunk.level >= 50
  const timeout = 0.5

  const profile = _.get(config, 'credentials.profile')
  if (profile) {
    config.credentials = new aws.SharedIniFileCredentials({ profile })
  }

  config.buffer = { hasPriority, timeout }

  const stream = bunyanFirehose.createStream(config)

  stream.on('error', err => log.error(err, 'Firehose stream error'))

  return { type, level, stream }
}
