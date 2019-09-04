const path = require('path')
const LogReader = require('../build/LogReader').default
const LogRecord = require('../build/LogRecord').default

async function readLog () {
  try {
    const logFilename = path.resolve(__dirname, '../.db/LOG')
    console.time('read_log')
    const logReader = new LogReader(logFilename, LogRecord)
    for await (let op of logReader.iterator()) {
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
