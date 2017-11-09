'use strict'

const EventEmitter = require('events')
const RequestNamespace = require('../../lib/requestNamespace')

describe('RequestNamespace', () => {

  it('should save namespace to local storage', done => {
    const emitter = new EventEmitter()
    const namespace = {
      field1: 'value1',
      field2: 'value2'
    }

    const test = () => {
      const requestNamespace = new RequestNamespace()
      const value1 = requestNamespace.get('field1')
      const value2 = requestNamespace.get('field2')

      value1.should.equal(namespace.field1)
      value2.should.equal(namespace.field2)

      done()
    }

    const requestNamespace = new RequestNamespace(namespace)
    requestNamespace.save([emitter], () => {
      test()
    })
  })

  it('should throw an exception on saving empty namespace', done => {
    const requestNamespace = new RequestNamespace()

    try {
      requestNamespace.save([])

    } catch (error) {
      error.name.should.equal('UndefinedNamespaceError')
      done()

    }
  })

  it('should get a value from local namespace', done => {
    const namespace = {
      field1: 'value1',
      field2: 'value2'
    }

    const requestNamespace = new RequestNamespace(namespace)

    const field1 = requestNamespace.get('field1')

    expect(field1).to.equal('value1')

    done()
  })

  it('should getAll value from local namespace', done => {
    const namespace = {
      field1: 'value1',
      field2: 'value2'
    }

    const requestNamespace = new RequestNamespace(namespace)

    const _namespace = requestNamespace.getAll()

    expect(_namespace.field1).to.equal('value1')
    expect(_namespace.field2).to.equal('value2')

    done()
  })

  it('should getAll values from local storage', done => {
    const namespace = {
      field1: 'value1',
      field2: 'value2'
    }

    const test = () => {
      const requestNamespace = new RequestNamespace()
      const namespace = requestNamespace.getAll()

      expect(namespace.field1).to.equal('value1')
      expect(namespace.field2).to.equal('value2')

      done()
    }

    const requestNamespace = new RequestNamespace(namespace)
    requestNamespace.save([], () => {
      test()
    })
  })


  it('should getAll empty namespace from local storage', done => {
    const requestNamespace = new RequestNamespace()
    const namespace = requestNamespace.getAll()

    expect(namespace).to.be.empty
    done()
  })

  it('should set value to local namespace', done => {
    const namespace = {
      field1: 'value1',
      field2: 'value2'
    }

    const requestNamespace = new RequestNamespace(namespace)
    requestNamespace.set('field3', 'value3')

    const _namespace = requestNamespace.getAll()

    expect(_namespace.field1).to.equal('value1')
    expect(_namespace.field2).to.equal('value2')
    expect(_namespace.field3).to.equal('value3')

    done()
  })

  it('should set value to local storage', done => {
    const namespace = {
      field1: 'value1',
      field2: 'value2'
    }

    const test = () => {
      const requestNamespace = new RequestNamespace()
      requestNamespace.set('field3', 'value3')

      const _namespace = requestNamespace.getAll()

      expect(_namespace.field1).to.equal('value1')
      expect(_namespace.field2).to.equal('value2')
      expect(_namespace.field3).to.equal('value3')

      done()
    }

    const requestNamespace = new RequestNamespace(namespace)
    requestNamespace.save([], () => {
      test()
    })
  })

})
