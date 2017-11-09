'use strict'

const neverDelete  = require('../../../../lib/db/mongodb/plugins/neverDelete')
const exportPlugin = require('../../../../lib/db/mongodb/plugins/export')

describe('export', () => {

  afterEach(go => {
    mongoose.model('User').collection.drop(() => {
      delete mongoose.models.User
      go()
    })
  })

  it('should export only fields specified via exportsOnly', done => {
    const userSchema = new mongoose.Schema({
      name: String,
      dept: String
    })

    userSchema.plugin(neverDelete)
    userSchema.plugin(exportPlugin)
    userSchema.exportsOnly([ 'name' ])

    const User  = mongoose.model('User', userSchema)
    const user1 = new User({ name: 'Charlie', dept: 'Support' })
    const user2 = new User({ name: 'Charlene', dept: 'Marketing' })

    Promise.resolve()
      .then(() => user1.save())
      .then(() => user2.save())
      .then(() => User.export())
      .then(csv => csv.split('\n')[0].should.equal('"name"'))
      .then(() => done())
  })

})
