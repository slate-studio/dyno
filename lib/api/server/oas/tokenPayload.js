'use strict'

const debug = require('debug')('swagger:tokenPayload')

const payload = (req, res, next) => {
  console.log(req.authenticationTokenPayload)

  if (req.authenticationTokenPayload) {
    for (const key in req.authenticationTokenPayload) {
      const value = req.authenticationTokenPayload[key]
      req.requestNamespace.set(key, value)
    }
  }

  next()
}

module.exports = function create(fittingDef) {
  debug('config: %j', fittingDef)

  return function tokenPayload(context, cb) {
    debug('exec')
    payload(context.request, context.response, cb)
  }
}
