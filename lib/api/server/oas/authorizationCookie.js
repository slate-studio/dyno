'use strict'

module.exports = (req, res, next) => {
  const token = req.cookies.access_token

  if (token && !req.headers['authorization']) {
    req.headers['authorization'] = `Bearer ${token}`
  }

  next()
}
