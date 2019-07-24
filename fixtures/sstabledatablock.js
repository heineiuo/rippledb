const fs = require('fs').promises
const path = require('path')
const SSTableDataBlock = require('../build/SSTableDataBlock').default

async function main () {
  console.time('sstabledatablock')
  const block = new SSTableDataBlock()
  block.append({ key: 'key1', value: '1' })
  block.append({ key: 'key2', value: '2' })
  block.append({ key: 'key3', value: '3' })
  block.append({ key: 'key4', value: '4' })
  block.append({ key: 'key5', value: '5' })
  // console.log(block.buffer)
  // await fs.writeFile(path.resolve(__dirname, '../.db/sstabledatablock'), block.buffer)
  // console.log('block.buffer.length ' + block.buffer.length)

  let iterator = block.iterator()
  let result = iterator.next()
  while (!result.done) {
    console.log(result.value)
    result = iterator.next()
    // let result = block.iterator().next()
    // console.log(result)
  }
  console.timeEnd('sstabledatablock')
}

main()
