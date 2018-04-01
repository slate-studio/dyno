'use strict'

module.exports = {
  autoIncrement:          require('./autoIncrement'),
  createOnce:             require('./createOnce'),
  customOrder:            require('./customOrder'),
  createOrUpdate:         require('./createOrUpdate'),
  export:                 require('./export'),
  insert:                 require('./insert'),
  neverDelete:            require('./neverDelete'),
  responsable:            require('./responsable'),
  simulateUnhandledError: require('./simulateUnhandledError'),
  userstamp:              require('./userstamp'),
  timestamp:              require('mongoose-timestamp'),
}
