const SSTableDataBlock = require('../build/SSTableDataBlock').default

async function main () {
  console.time('sstabledatablock_append')
  const block = new SSTableDataBlock()
  block.append({ key: 'key1', value: '1' })
  block.append({ key: 'key2', value: '2' })
  block.append({ key: 'key3', value: '3' })
  block.append({ key: 'key4', value: '4' })
  block.append({ key: 'key5', value: '5' })
  console.timeEnd('sstabledatablock_append')
  console.time('sstabledatablock_iterator')

  let iterator = block.iterator()
  let result = iterator.next()
  while (!result.done) {
    // console.log(result.value)
    result = iterator.next()
  }
  console.timeEnd('sstabledatablock_iterator')
}

main()
