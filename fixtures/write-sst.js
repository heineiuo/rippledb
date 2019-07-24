const path = require('path')
const fs = require('fs').promises
const SSTable = require('../build/SSTable').default

async function writeSSTableToDisk () {
  const sst = new SSTable()

  const sstFilePath = path.resolve(__dirname, '../.db/test.sst')
  await fs.writeFile(sstFilePath, sst.toBuffer())
}

writeSSTableToDisk()
