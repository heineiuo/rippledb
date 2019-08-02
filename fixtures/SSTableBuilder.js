const fs = require('fs').promises
const path = require('path')
const SSTableBuilder = require('../build/SSTableBuilder').default

async function main () {
  function padLeft (str, total = 10) {
    if (str.length < total) {
      return padLeft(`0${str}`, total)
    }
    return str
  }

  function sortedKey (index) {
    return `key${padLeft(String(index))}`
  }

  function randomValue (index) {
    return `value${padLeft(String(index))}`
  }

  try {
    console.time(`SSTableBuilder 50000 records`)
    const tablePath = path.resolve(__dirname, '../.db/0001.ldb')
    // await fs.writeFile(tablePath, Buffer.alloc(0))
    const file = await fs.open(tablePath, 'w')
    const table = new SSTableBuilder(file)

    let i = 0
    while (i < 50000) {
      await table.add(sortedKey(i), randomValue(i))
      i++
    }

    await table.close()
    console.timeEnd(`SSTableBuilder 50000 records`)
  } catch (e) {
    console.error(e)
  }
}

main()
