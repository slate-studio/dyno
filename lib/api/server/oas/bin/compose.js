#!/usr/bin/env node

'use strict'

const fs   = require('fs')
const path = require('path')

const rootPath            = process.cwd()
const sourcePath          = `${rootPath}/src/api`
const controllerFieldName = 'x-swagger-router-controller'
let swaggerSchema         = ''

const read = (dir) =>
  fs.readdirSync(dir)
    .reduce((files, file) =>
      fs.statSync(path.join(dir, file)).isDirectory() ?
        files.concat(read(path.join(dir, file))) :
        files.concat(path.join(dir, file)),
    [])

let sourceFiles = read(sourcePath)

sourceFiles = sourceFiles
  .filter(f => !f.endsWith('api/header.yaml'))
  .filter(f => !f.endsWith('api/swagger.yaml'))
  .filter(f => !f.endsWith('api/_paths/swagger.yaml'))

const paths = {}
const tags  = []

sourceFiles
  .filter(f => !f.includes('definitions'))
  .filter(f => f.endsWith('.yaml'))
  .forEach(f => {
    const parsePath           = f.split('/')
    const controllerName      = parsePath[parsePath.length - 2]
    const operationIdFileName = parsePath[parsePath.length - 1]
    const operationId         = operationIdFileName
      .replace('.yaml', '')
      .replace('_', '')

    const lines = fs.readFileSync(f, 'utf8').split('\n')

    lines[1] = lines[1] +
    '\n      tags:' +
    `\n        - ${controllerName}` +
    `\n      operationId: ${operationId}`

    const key        = '  ' + lines[0]
    const controller = '    ' + controllerFieldName + ': ' + controllerName
    const operation  = '  ' + lines.slice(1).join('\n  ')

    paths[key]            = paths[key] || {}
    paths[key].controller = controller
    paths[key].operations = paths[key].operations || []
    paths[key].operations.push(operation)
    tags.push(controllerName)
  })

swaggerSchema += 'paths:'


Object
  .keys(paths)
  .forEach(key => {
    let obj = paths[key]
    swaggerSchema += `\n${key}`
    swaggerSchema += `\n${obj.controller}`

    obj.operations.forEach(operation => swaggerSchema += `\n${operation}`)
  })

const definitions = sourceFiles
  .filter(f => f.includes('definitions'))
  .filter(f => f.endsWith('.yaml'))

if (definitions.length > 0) {
  swaggerSchema += '\ndefinitions:'

  definitions.forEach(f => {
    const content = fs.readFileSync(f, 'utf8').split('\n').join('\n  ')
    swaggerSchema += `\n  ${content}`
  })

} else {
  swaggerSchema += '\ndefinitions: {}'

}

const headerLines = fs.readFileSync(`${sourcePath}/header.yaml`, 'utf8').split('\n')
let header        = ''
const lastIndex   = headerLines.length - 1

headerLines[lastIndex] += '\ntags:'

tags.filter((v, i, a) => a.indexOf(v) === i)
  .forEach(tag => {
    headerLines[lastIndex] += `\n  - name: ${tag}`
  })

headerLines.forEach(line => header += `${line}\n`)
swaggerSchema = `${header}\n${swaggerSchema}`

console.log(swaggerSchema) // eslint-disable-line no-console
