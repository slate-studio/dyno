'use strict'

const statuses     = require('statuses')
const EventEmitter = require('events')

class ServerResponse extends EventEmitter {
  
  constructor() {
    super()
    this.headers            = {}
    this.output             = [],
    this.outputEncodings    = [],
    this.outputCallbacks    = [],
    this.outputSize         = 0,
    this.writable           = true
    this._last              = false
    this.upgrading          = false
    this.sendDate           = true
    this._removedTE         = false
    this.finished           = false
    this._header            = null
    this._headerSent        = false
    // this._hasBody        = true
    this.chunkedEncoding    = false
    this.shouldKeepAlive    = false
    this._removedConnection = false
    this._removedContLen    = false
    this._contentLength     = null
    this.body               = null
    this.useChunkedEncodingByDefault = true

    this.setHeader('Content-Type', 'application/json')
  }

  getResponseData() {
    const headers       = this.headers
    const body          = this.body
    const statusCode    = this.statusCode
    const statusMessage = this.statusMessage
    const object        = { headers, body, statusCode, statusMessage }
    const json          = stringify(object)

    return json
  }

  status(code) {
    this.statusCode    = code
    this.statusMessage = statuses[code] || String(statusCode)
    return this
  }

  json(obj) {
    return this.send(body)
  }

  sendStatus(statusCode) {
    var body        = statuses[statusCode] || String(statusCode)
    this.statusCode = statusCode

    return this._send(body)
  }

  send(body) {
    if (!this.get('Content-Type')) {
      this.set('Content-Type', 'application/json')
    }

    return this._send(body)
  }

  _send(body) {
    this.end(body)
    return this
  }

  setHeader(name, value) {
    const key         = name.toLowerCase()
    this.headers[key] = value
    return this
  }

  getHeader(name) {
    if (typeof name !== 'string') {
      throw new TypeError('"name" argument must be a string')
    }

    const key = name.toLowerCase()
    return this.headers[key]
  }

  header(field, val) {
    if (arguments.length === 2) {
      const value = String(val)
      this.setHeader(field, value)
    } else {
      for (let key in field) {
        this.set(key, field[key])
      }
    }

    return this
  }

  set(name, value) {
    return this.header(name, value)
  }

  get(name) {
    return this.getHeader(name)
  }

  end(chunk, encoding, callback) {
    this.finished    = true
    this.writable    = false
    this._headerSent = true
    this.body        = chunk

    if (typeof callback === 'function') {
      this.once('finish', callback)
    }

    this.emit('finish')
  }
}

const stringify = (value, replacer, spaces, escape) => {
  // v8 checks arguments.length for optimizing simple call
  // https://bugs.chromium.org/p/v8/issues/detail?id=4730
  const json = replacer || spaces
    ? JSON.stringify(value, replacer, spaces)
    : JSON.stringify(value);

  if (escape) {
    json = json.replace(/[<>&]/g, function (c) {
      switch (c.charCodeAt(0)) {
        case 0x3c:
          return '\\u003c'
        case 0x3e:
          return '\\u003e'
        case 0x26:
          return '\\u0026'
        default:
          return c
      }
    })
  }

  return json
}

exports = module.exports = ServerResponse
