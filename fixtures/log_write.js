const path = require('path')
const LogWriter = require('../build/LogWriter').default
const LogRecord = require('../build/LogRecord').default
const Slice = require('../build/Slice').default

async function logWrite () {
  const logFilename = path.resolve(__dirname, '../.db/0001.log')
  const log = new LogWriter(logFilename)
  let i = 0
  while (i < 20) {
    // await log.add(new Slice(`key${i}`), new Slice(`value${i}`))
    // max block sisze = 32768
    const slice = LogRecord.add(new Slice(`key${i}`), new Slice(Buffer.alloc(65500)))
    await log.addRecord(slice)
    i++
  }
}

logWrite()
