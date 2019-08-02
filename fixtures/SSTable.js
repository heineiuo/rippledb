const fs = require('fs').promises
const path = require('path')
const SSTable = require('../build/SSTable').default
const SSTableFooter = require('../build/SSTableFooter').default

async function main () {
  const ldbPath = path.resolve(__dirname, '../.db/0001.ldb')
  const buf = await fs.readFile(ldbPath)
  const footer = new SSTableFooter(buf)
  console.log(footer.get())
}

main()
