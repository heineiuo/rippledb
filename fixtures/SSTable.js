const fs = require('fs').promises
const path = require('path')
const SSTable = require('../build/SSTable').default

async function main () {
  try {
    const ldbPath = path.resolve(__dirname, '../.db/0001.ldb')
    const buf = await fs.readFile(ldbPath)
    const table = new SSTable(buf)
    // console.log(table._footer.get())

    console.time('SSTable iterator')
    let indexBlockIterator = table.dataBlockIterator()
    let result = indexBlockIterator.next()
    while (!result.done) {
      console.log(result.value)
      result = indexBlockIterator.next()
    }
    console.timeEnd('SSTable iterator')
  } catch (e) {
    console.error(e)
  }
}

main()
