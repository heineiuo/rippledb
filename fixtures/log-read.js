const path = require('path')
const fs = require('fs')
const Log = require('../dist/Log').default
const dbpath = require('./dbpath')

const log = new Log(dbpath)

console.time('log read')

const record = log.parseRecord(fs.readFileSync(log._logPath))

console.timeEnd('log read')

console.log({
  key: record.key.toString(),
  value: record.value.toString()
})
