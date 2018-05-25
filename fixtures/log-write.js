const path = require('path')
const fs = require('fs')
const Log = require('../dist/Log').default

const dbpath = path.resolve(__dirname, '../.db')

const log = new Log(dbpath)

console.time('log write')
let record = log.createRecord(Buffer.from('abcde'), Buffer.from(
  JSON.stringify({
    hello: 'world'
  })
))

console.timeEnd('log write')

fs.writeFileSync(log._logPath, record)
console.log(record)

