'use strict'

const simulateUnhandledError =
  require('../../../../lib/db/mongodb/plugins/simulateUnhandledError')

describe('simulateUnhandledError', () => {

  afterEach(done => {
    delete mongoose.models.Test
    done()
  })

  it('should save without error', done => {
    const testSchema = new mongoose.Schema({ field: String })

    testSchema.plugin(simulateUnhandledError)

    const Test  = mongoose.model('Test', testSchema)

    const test1 = new Test({ field: 'field1' })

    Promise.resolve()
      .then(() => test1.save())
      .then(() => done())
      .catch(() => done('There was an error while saving'))
  })

  it('should raise exception while saving', done => {
    const testSchema = new mongoose.Schema({ field: String })

    testSchema.plugin(simulateUnhandledError)

    const Test  = mongoose.model('Test', testSchema)
    Test.schema.simulateUnhandledError()

    const test1 = new Test({ field: 'field1' })

    Promise.resolve()
      .then(() => test1.save())
      .then(() => done('No raise `UnhandledError` exception'))
      .catch(() => done())
  })

  it('should raise exception during the second save', done => {
    const testSchema = new mongoose.Schema({ field: String })

    testSchema.plugin(simulateUnhandledError)

    const Test  = mongoose.model('Test', testSchema)
    Test.schema.simulateUnhandledError(1)

    const test1 = new Test({ field: 'field1' })
    const test2 = new Test({ field: 'field2' })

    Promise.resolve()
      .then(() => test1.save())
      .then(test => test.should.have.property('field', 'field1'))
      .catch(() => done(new Error('There was an error while saving first object')))
      .then(() => test2.save())
      .then(() => done(new Error('No raise `UnhandledError` exception')))
      .catch(error => {
        if (error.name !== 'UnhandledMongodbError') {
          return done(error)
        }

        done()
      })
  })

})
