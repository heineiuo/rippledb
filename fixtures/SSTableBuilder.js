const fs = require('fs').promises
const path = require('path')
const SSTableBuilder = require('../build/SSTableBuilder').default

async function main () {
  const tablePath = path.resolve(__dirname, '../.db/0001.ldb')
  await fs.writeFile(tablePath, Buffer.alloc(0))
  const file = await fs.open(tablePath)
  const table = new SSTableBuilder(file)

  table.add('key1', 'value1')
  await table.close()
  console.log(table)
}

main()
