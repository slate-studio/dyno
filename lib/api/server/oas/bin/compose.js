#!/usr/bin/env node

'use strict'

const fs   = require('fs')
const path = require('path')

const rootPath            = process.cwd()
const sourcePath          = `${rootPath}/src/api`
const controllerFieldName = 'x-swagger-router-controller'

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

const header = fs.readFileSync(`${sourcePath}/header.yaml`, 'utf8')

console.log(header)

const paths = {}

sourceFiles
  .filter(f => !f.includes('definitions'))
  .filter(f => f.endsWith('.yaml'))
  .forEach(f => {
    const parsePath           = f.split('/')
    const controllerName      = parsePath[parsePath.length - 2]
    const operationIdFileName = parsePath[parsePath.length - 1]
    const operationId         = operationIdFileName.replace('.yaml', '')
                                                   .replace('_', '')

    const lines = fs.readFileSync(f, 'utf8').split('\n')
    lines[1]    = lines[1] + `\n      operationId: ${operationId}`

    const key        = '  ' + lines[0]
    const controller = '    ' + controllerFieldName + ': ' + controllerName
    const operation  = '  ' + lines.slice(1).join('\n  ')

    paths[key]            = paths[key] || {}
    paths[key].controller = controller
    paths[key].operations = paths[key].operations || []
    paths[key].operations.push(operation)
  })

console.log('paths:')

Object
  .keys(paths)
  .forEach(key => {
    let obj = paths[key]
    console.log(key)
    console.log(obj.controller)

    obj.operations.forEach(operation => console.log(operation))
  })

const definitions = sourceFiles
  .filter(f => f.includes('definitions'))
  .filter(f => f.endsWith('.yaml'))

if (definitions.length > 0) {
  console.log('definitions:')

  definitions.forEach(f => {
    const content = fs.readFileSync(f, 'utf8').split('\n').join('\n  ')
    console.log(`  ${content}`)
  })

} else {
  console.log('definitions: {}')

}
