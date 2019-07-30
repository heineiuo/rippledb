const fs = require('fs').promises
const SSTable = require('../build/SSTable').default

const table = new SSTable()

table.add()
