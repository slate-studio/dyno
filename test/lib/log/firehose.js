'use strict'

const logger = require('../../lib/log')
const config = {
  log: {
    level: 'debug',
    firehose: {
      streamName: 'develop-kinesis-firehose-app-log-stream',
      region:     'us-east-1',
      credentials: {
        profile: 'developer'
      }
    }
  }
}

// NOTE: Both of these scenarios require a code injection in flush method
//       of bunyanStream.js file in bunyan-firehose package.
//
//       flush() {
//         console.log('flush')
//         this.dispatch(this.recordsQueue.splice(0, this.buffer.length))
//       }

// NOTE: This is test for priority configuraton of the firehose logger.
//       Here we make sure that errors are sent to the server right
//       before app exits.
return logger(config)
  .then(() => {
    new RaiseUnhandledException()
  })


// NOTE: This is test for timeout (500ms) config of the firehose logger.
//       Here we make sure that data got send to the server before exit.
// return logger(config)
//   .then(() => {
//     log.info('Testing log') ; setTimeout(() => process.exit(1), 1000)
//   })
