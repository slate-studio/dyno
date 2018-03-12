'use strict'

const _   = require('lodash')
const os  = require('os')
const aws = require('aws-sdk')

const jsonRequest = require('../jsonRequest')

const getRancherEnvironment = () => {
  return new Promise((resolve) => {
    if (process.env.CLOUD_ENV) {
      return resolve(process.env.CLOUD_ENV)
    }

    const url = 'http://rancher-metadata/2015-12-19/self/stack/environment_name'

    jsonRequest({ url })
      .then(res => {
        const environment = res.object
        return resolve(environment)
      })
      .catch(err => {
        const environment = 'null'
        log.error('Get Rancher environment error:', err)

        return resolve(environment)
      })
  })
}

const getAwsMetadata = () => {
  const options = {
    httpOptions: { timeout: 200 },
    maxRetries: 1
  }

  const meta = new aws.MetadataService(options)

  let metadata

  return new Promise((resolve, reject) => {
    meta.request('/latest/dynamic/instance-identity/document', (err, data) => {
      if (err) {
        return reject(err)
      }

      const object = JSON.parse(data)
      const fields = [
        'privateIp',
        'availabilityZone',
        'instanceId',
        'instanceType',
        'accountId',
        'imageId',
        'region' ]

      metadata = _.pick(object, fields)

      return resolve()
    })
  })
    .then(() => {
      const region     = metadata.region
      const instanceId = metadata.instanceId

      const ec2 = new aws.EC2({ region })

      const Name    = 'resource-id'
      const Values  = [ instanceId ]
      const Filters = [ { Name, Values } ]

      return ec2.describeTags({ Filters }).promise()
    })
    .then(data => {
      metadata.tags = {}

      _.forEach(data.Tags, tag => {
        const name  = tag.Key.toLowerCase()
        const value = tag.Value

        metadata.tags[name] = value
      })

      return metadata
    })
    .catch(err => {
      log.error('Get AWS metadata error: ', err)

      return {}
    })
}

const getMetadata = () => {
  let metadata

  // NOTE: Here we consider non production environment to be developers machine
  //       so there is no Rancher / AWS.
  if (process.env.NODE_ENV !== 'production') {
    metadata = { environment: os.hostname() }

    return Promise.resolve(metadata)
  }

  return Promise.all([
    getAwsMetadata(),
    getRancherEnvironment()
  ]).then(results => {
    metadata = results[0]
    metadata.environment = results[1]

    return metadata
  })
}

exports = module.exports = getMetadata
