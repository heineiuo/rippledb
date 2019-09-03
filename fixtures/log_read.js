const path = require('path')
const Log = require('../build/Log').default

async function readLog () {
  try {
    const logFilename = path.resolve(__dirname, '../.db/LOG')
    console.time('read_log')
    for await (let op of Log.readIterator(logFilename)) {
      const strKey = op.key.toString()
      // console.log(op.type.key + strKey)
      const strValue = op.value.buffer
      // console.log(strValue)
    }
    console.timeEnd('read_log')
  } catch (e) {
    console.log(e)
  }
}

readLog()
