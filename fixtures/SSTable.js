const fs = require('fs').promises
const path = require('path')
const SSTable = require('../build/SSTable').default

async function main () {
  try {
    const ldbPath = path.resolve(__dirname, '../.db/0001.ldb')
    const buf = await fs.readFile(ldbPath)
    const table = new SSTable(buf)
    // console.log(table._footer.get())

    console.time('SSTable iterator 50000 record')
    let indexBlockIterator = table.dataBlockIterator()
    let result = indexBlockIterator.next()
    while (!result.done) {
      result = indexBlockIterator.next()
    }
    console.timeEnd('SSTable iterator 50000 record')

    console.log('get value:', table.get('key0000001001'))
    console.time('get value spent')
    table.get('key0000001001')
    console.timeEnd('get value spent')
  } catch (e) {
    console.error(e)
  }
}

main()
