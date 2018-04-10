'use strict'

const orderable = require('../../../../../lib/db/mongodb/plugins/orderable')

describe('orderable', () => {

  afterEach(done => {
    mongoose.model('User').collection.drop(() => {
      delete mongoose.models.User
      done()
    })
  })

  it('should add position field on save with values == 1000', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(orderable, { fieldName: 'position' })

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user1.should.have.property('position', 1000))
      .then(() => done())
  })

  it('should increment by 10 position value on save from last element', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(orderable, { fieldName: 'position' })

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })
    const user2 = new User({ name: 'Michael', dept: 'Support' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user2.save())
      .then(() => user2.should.have.property('position', 1010))
      .then(() => done())
  })

})
