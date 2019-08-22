const path = require('path')
const fs = require('fs')
const Log = require('../build/Log').default
const Slice = require('../build/Slice').default

const dbpath = path.resolve(__dirname, '../.db')

const log = new Log(dbpath)

console.time('log write')
let record = log.createRecord(
  new Slice('abcde'), 
  new Slice({ hello: 'world' })
)

console.timeEnd('log write')

fs.writeFileSync(log._logPath, record)
console.log(record)

