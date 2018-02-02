'use strict'

const authenticationToken = (req, spec, authenticationToken, callback) => {
  const Authentication = req.app.get('Authentication')

  if (!Authentication) {
    return callback()
  }

  const authentication = new Authentication(authenticationToken, req)
  return authentication.exec(callback)
}

exports = module.exports = {
  authenticationToken
}