'use strict'

const autoIncrement = require('../../../../../lib/db/mongodb/plugins/autoIncrement')

describe('autoIncrement', () => {

  afterEach(done => {
    mongoose.model('User').collection.drop(() => {
      delete mongoose.models.User
      mongoose.model('IdentityCounter').collection.drop(done)
    })
  })

  it('should increment the integerId field on save', async() => {
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

    await user1.save()
    user1.should.have.property('_integerId', 1)
    await user2.save()
    user2.should.have.property('_integerId', 2)

    const userSchema2 = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema2.plugin(autoIncrement, { model: 'User', mongoose })
  })

  it('should increment the specified field instead', async() => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(autoIncrement, { model: 'User', field: 'userId', mongoose })

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })
    const user2 = new User({ name: 'Charlene', dept: 'Marketing' })

    await user1.save()
    user1.should.have.property('userId', 1)
    await user2.save()
    user2.should.have.property('userId', 2)
  })

  it('should start counting at specified number', async() => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(autoIncrement, { model: 'User', startAt: 3, mongoose })

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })
    const user2 = new User({ name: 'Charlene', dept: 'Marketing' })

    await user1.save()
    user1.should.have.property('_integerId', 3)
    await user2.save()
    user2.should.have.property('_integerId', 4)
  })

  it('should increment by the specified amount', async() => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(autoIncrement, { model: 'User', incrementBy: 5, mongoose })

    const User = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })
    const user2 = new User({ name: 'Charlene', dept: 'Marketing' })

    await user1.save()
    user1.should.have.property('_integerId', 1)
    await user2.save()
    user2.should.have.property('_integerId', 6)
  })

  it('should not allow to update integerId', async() => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(autoIncrement, { model: 'User', mongoose })

    const User = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })

    await user1.save()
    user1.should.have.property('_integerId', 1)

    user1.name = 'Alexander Kravets'
    const user = await user1.save()
    user.name.should.equal('Alexander Kravets')

    user1._integerId = 2
    try {
      await user1.save()

    } catch (error) {
      expect(error.name).to.equal('UpdateAutoIncrementFieldValueError')

    }
  })

  it('should raise exception if auto increment value is not integer', async() => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(autoIncrement, { model: 'User', mongoose })

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support', '_integerId': 1.2 })
    const user2 = new User({ name: 'Charlie', dept: 'Support', '_integerId': 3 })

    try {
      await user1.save()

    } catch (error) {
      expect(error.name).to.equal('BadAutoIncrementFieldValueError')

    }

    await user2.save()
    user2.should.have.property('_integerId', 3)
  })

  describe('Model.nextCount', () => {

    it('should return the next count for the model', async() => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String
      })

      userSchema.plugin(autoIncrement, { model: 'User', mongoose })

      const User = mongoose.model('User', userSchema)
      const user1 = new User({ name: 'Charlie', dept: 'Support' })
      const user2 = new User({ name: 'Charlene', dept: 'Marketing' })

      let count
      let user

      count = await User.nextCount()
      count.should.equal(1)

      user = await user1.save()
      user.should.have.property('_integerId', 1)

      count = await User.nextCount()
      count.should.equal(2)

      user = await user2.save()
      user2.should.have.property('_integerId', 2)

      count = await User.nextCount()
      count.should.equal(3)
    })

  })

  describe('Model.resetCount', () => {

    it('should set count to initial value', async() => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String
      })

      userSchema.plugin(autoIncrement, { model: 'User', mongoose })

      const User = mongoose.model('User', userSchema)
      const user = new User({name: 'Charlie', dept: 'Support'})

      let count
      let resetCount

      await user.save()
      user.should.have.property('_integerId', 1)

      count = await user.nextCount()
      count.should.equal(2)

      resetCount = await user.resetCount()
      resetCount.should.equal(1)

      count = await user.nextCount()
      count.should.equal(1)
    })

  })

  describe('Model.setCount', () => {

    it('should set count to specified value', async() => {
      const userSchema = new mongoose.Schema({
        name: String,
        dept: String
      })

      userSchema.plugin(autoIncrement, { model: 'User', mongoose })

      const User = mongoose.model('User', userSchema)
      const user = new User({ name: 'Charlie', dept: 'Support' })

      let count

      count = await User.setCount(5)
      count.should.equal(5)

      count = await user.nextCount()
      count.should.equal(6)

      await user.save()
      user.should.have.property('_integerId', 6)
    })

  })

})
