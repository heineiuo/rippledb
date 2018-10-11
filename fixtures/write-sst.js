const path = require('path')
const SSTable = require('../dist/SSTable').default

console.log(SSTable)

const sst = new SSTable(path.resolve(__dirname, '../.db/test.sst'))