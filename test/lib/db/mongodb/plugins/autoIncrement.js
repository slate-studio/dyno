'use strict'

const autoIncrement = require('../../../../lib/db/mongodb/plugins/autoIncrement')

describe('autoIncrement', () => {

  afterEach(done => {
    mongoose.model('User').collection.drop(() => {
      delete mongoose.models.User
      mongoose.model('IdentityCounter').collection.drop(done)
    })
  })

  it('should increment the integerId field on save', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    expect(() => userSchema.plugin(autoIncrement))
      .to.throw('Model name is not defined in options')

    userSchema.plugin(autoIncrement, { model: 'User', mongoose })

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })
    const user2 = new User({ name: 'Charlene', dept: 'Marketing' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user1.should.have.property('integerId', 1))
      .then(() => user2.save())
      .then(() => user2.should.have.property('integerId', 2))
      .then(() => done())
  })

  it('should increment the specified field instead', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(autoIncrement, { model: 'User', field: 'userId', mongoose })

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })
    const user2 = new User({ name: 'Charlene', dept: 'Marketing' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user1.should.have.property('userId', 1))
      .then(() => user2.save())
      .then(() => user2.should.have.property('userId', 2))
      .then(() => done())
  })

  it('should start counting at specified number', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(autoIncrement, { model: 'User', startAt: 3, mongoose })

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })
    const user2 = new User({ name: 'Charlene', dept: 'Marketing' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user1.should.have.property('integerId', 3))
      .then(() => user2.save())
      .then(() => user2.should.have.property('integerId', 4))
      .then(() => done())
  })

  it('should increment by the specified amount', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(autoIncrement, { model: 'User', incrementBy: 5, mongoose })

    const User = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })
    const user2 = new User({ name: 'Charlene', dept: 'Marketing' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user1.should.have.property('integerId', 1))
      .then(() => user2.save())
      .then(() => user2.should.have.property('integerId', 6))
      .then(() => done())
  })

  it('should not allow to update integerId', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(autoIncrement, { model: 'User', mongoose })

    const User = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user1.should.have.property('integerId', 1))
      .then(() => {
        user1.name = 'Alexander Kravets'
        return user1.save()
      })
      .then(user => user.name.should.equal('Alexander Kravets'))
      .then(() => {
        user1.integerId = 2
        return user1.save()
      })
      .catch(error => {
        expect(error.name).to.equal('UpdateAutoIncrementFieldValueError')
        done()
      })
  })

  it('should raise exception if auto increment value is not integer', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(autoIncrement, { model: 'User', mongoose })

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support', 'integerId': 1.2 })
    const user2 = new User({ name: 'Charlie', dept: 'Support', 'integerId': 3 })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user1.should.have.property('integerId', 1))
      .catch(error => {
        expect(error.name).to.equal('BadAutoIncrementFieldValueError')
      })
      .then(() => user2.save())
      .then(() => user2.should.have.property('integerId', 3))
      .then(() => done())
  })

  describe('Model.nextCount', () => {

    it('should return the next count for the model', done => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String
      })

      userSchema.plugin(autoIncrement, { model: 'User', mongoose })

      const User = mongoose.model('User', userSchema)
      const user1 = new User({ name: 'Charlie', dept: 'Support' })
      const user2 = new User({ name: 'Charlene', dept: 'Marketing' })

      Promise.resolve()
        .then(() => User.nextCount())
        .then(count => count.should.equal(1))
        .then(() => user1.save())
        .then(user1 => user1.should.have.property('integerId', 1))
        .then(() => User.nextCount())
        .then(count => count.should.equal(2))
        .then(() => user2.save())
        .then(user1 => user2.should.have.property('integerId', 2))
        .then(() => User.nextCount())
        .then(count => count.should.equal(3))
        .then(() => done())
    })

  })

  describe('Model.resetCount', () => {

    it('should set count to initial value', done => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String
      })

      userSchema.plugin(autoIncrement, { model: 'User', mongoose })

      const User = mongoose.model('User', userSchema)
      const user = new User({name: 'Charlie', dept: 'Support'})

      Promise.resolve()
        .then(() => user.save())
        .then(() => user.should.have.property('integerId', 1))
        .then(() => user.nextCount())
        .then(count => count.should.equal(2))
        .then(() => user.resetCount())
        .then(resetCount => resetCount.should.equal(1))
        .then(() => user.nextCount())
        .then(count => count.should.equal(1))
        .then(() => done())
    })

  })

  describe('Model.setCount', () => {

    it('should set count to specified value', done => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String
      })

      userSchema.plugin(autoIncrement, { model: 'User', mongoose })

      const User = mongoose.model('User', userSchema)
      const user = new User({ name: 'Charlie', dept: 'Support' })

      Promise.resolve()
        .then(() => User.setCount(5))
        .then(count => count.should.equal(5))
        .then(() => user.nextCount())
        .then(count => count.should.equal(6))
        .then(() => user.save())
        .then(() => user.should.have.property('integerId', 6))
        .then(() => done())
    })

  })

})
