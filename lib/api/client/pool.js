'use strict'

const dns  = require('dns')
const net  = require('net')
const http = require('http')
const lb_pool          = require('lb_pool')
const { NetworkError } = require('../../httpRequest')
const resolveAsync     = Promise.promisify(dns.resolve4)

const ENDPOINTS_REFRESH_INTERVAL = 30 * 1000

class Pool {
  constructor(name, hostPort) {
    const [ host, port ] = hostPort.split(':')

    this.name = name
    this.host = host
    this.port = port

    this.isHostIP  = net.isIP(host)
    this.endpoints = []
  }

  async _resolveEndpoints() {
    const ips = await resolveAsync(this.host)
    return ips.map(ip => `${ip}:${this.port}`)
  }

  async _refreshEndpoints() {
    const endpoints = await this._resolveEndpoints()

    for (const endpoint of endpoints) {
      if (this.endpoints.indexOf(endpoint) < 0) {
        log.info(`[client] Add new endpoint ${endpoint} to ${this.name} pool`)
        this.pool.add_endpoint(endpoint)
      }
    }

    for (const endpoint of this.endpoints) {
      if (endpoints.indexOf(endpoint) < 0) {
        log.info(`[client] Remove endpoint ${endpoint} from ${this.name} pool`)
        this.pool.remove_endpoint(endpoint)
      }
    }

    this.endpoints = endpoints
    const stats = this.pool.stats()
    const pool  = { stats, name: this.name }
    log.debug({ pool }, `[client] ${this.name} pool status`)
  }

  async initialize() {
    if (this.isHostIP) {
      this.endpoints = [ `${this.host}:${this.port}` ]

    } else {
      this.endpoints = await this._resolveEndpoints()

    }

    this.pool = new lb_pool.Pool(http, this.endpoints, {
      name:        this.name,
      ping:        '/health',
      timeout:     10000,
      max_sockets: 2,
      max_pending: 300
    })

    this.pool.on('health', endpointHealth => log.info(`[client] ${endpointHealth}`))

    if (!this.isHostIP) {
      setInterval(() => this._refreshEndpoints(), ENDPOINTS_REFRESH_INTERVAL)
    }

    log.debug(`[client] Initialized pool for ${this.name}:`, this.endpoints)
  }

  request(options) {
    return new Promise((resolve, reject) => {
      this.pool.request(options, (lbPoolError, res, body) => {
        if (lbPoolError) {
          const stats = this.pool.stats()
          const error = new NetworkError({
            name:      this.name,
            host:      this.host,
            port:      this.port,
            endpoints: this.endpoints,
            message:   lbPoolError.message,
            reason:    lbPoolError.reason,
            delay:     lbPoolError.delay,
            stats
          })

          return reject(error)
        }

        res.body = body
        return resolve(res)
      })
    })
  }
}

module.exports = Pool
