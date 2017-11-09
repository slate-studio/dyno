'use strict'

const neverDelete = require('../../../../lib/db/mongodb/plugins/neverDelete')

describe('neverDelete', () => {

  afterEach(done => {
    mongoose.model('User').collection.drop(() => {
      delete mongoose.models.User
      done()
    })
  })

  it('should add _deleted field on save', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(neverDelete)

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user1.should.have.property('_deleted', false))
      .then(() => done())
  })

  it('should set _deleted flag for document via `delete` method', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(neverDelete)

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => User.find({}))
      .then(users => users.should.have.lengthOf(1))
      .then(() => user1.delete())
      .then(() => User.find({ name: 'Charlie' }))
      .then(users => users.should.have.lengthOf(0))
      .then(() => User.findOne({ name: 'Charlie' }))
      .then(user => should.not.exist(user))
      .then(() => User.where({ name: 'Charlie' }).count())
      .then(count => count.should.be.equal(0))
      .then(() => done())
  })

  it('should set _deleted flag for documents via `deleteAll` method', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(neverDelete)

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })
    const user2 = new User({ name: 'Alexander', dept: 'Support' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user2.save())
      .then(() => User.find({}))
      .then(users => users.should.have.lengthOf(2))
      .then(() => User.deleteMany({}))
      .then(() => User.find({ dept: 'Support' }))
      .then(users => users.should.have.lengthOf(0))
      .then(() => done())
  })

})
