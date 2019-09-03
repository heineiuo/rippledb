const path = require('path')
const Log = require('../build/Log').default
const Slice = require('../build/Slice').default

async function logWrite () {
  const logFilename = path.resolve(__dirname, '../.db/LOG')
  const log = new Log(logFilename)
  let i = 0
  while (i < 20) {
    // await log.add(new Slice(`key${i}`), new Slice(`value${i}`))
    // max block sisze = 32768
    await log.add(new Slice(`key${i}`), new Slice(Buffer.alloc(65500)))
    i++
  }
}

logWrite()
