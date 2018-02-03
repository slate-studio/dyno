'use strict'

const mongodb = require('./mongodb')
const {Mongodb, seed, skipCollections} = mongodb
const redis = require('./redis')
const {connect} = redis

exports = module.exports = {
  mongodb,
  mongodbStaff: {Mongodb, seed, skipCollections},
  redis,
  redisStaff:   {connect}
}
