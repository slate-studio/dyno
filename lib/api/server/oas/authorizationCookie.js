'use strict'

module.exports = (req, res, next) => {
  const token = req.cookies.Authorization

  if (token && !req.headers['authorization']) {
    req.headers['authorization'] = `Bearer ${token}`
  }

  next()
}
