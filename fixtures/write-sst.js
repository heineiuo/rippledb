const path = require('path')
const SSTable = require('../dist/SSTable')

const sst = new SSTable(path.resolve(__dirname, '../.db/test.sst'))