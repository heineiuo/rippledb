const path = require('path')
const Log = require('../dist/Log').default

const log = new Log(path.resolve(__dirname, '../.db'))

log.readLogRecord()
