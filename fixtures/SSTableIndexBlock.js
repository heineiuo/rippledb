const SSTableDataBlock = require('../build/SSTableDataBlock').default
const SSTableIndexBlock = require('../build/SSTableIndexBlock').default
const varint = require('varint')
const assert = require('assert')
// const fs = require('fs').promises

async function main () {
  const block = new SSTableDataBlock()
  block.append({ key: 'key1', value: '1' })
  block.append({ key: 'key2', value: '2' })
  block.append({ key: 'key3', value: '3' })
  block.append({ key: 'key4', value: '4' })
  block.append({ key: 'key5', value: '5' })

  // console.log('block1 size', block.size)

  const block2 = new SSTableDataBlock()

  block2.append({ key: 'key11', value: '11' })
  block2.append({ key: 'key12', value: '12' })
  block2.append({ key: 'key13', value: '13' })
  block2.append({ key: 'key14', value: '14' })
  block2.append({ key: 'key15', value: '15' })

  // console.log('block crc32', block2.crc32, block2.crc32.length)
  // console.log('block compression type', block2.compressionType.length)
  // console.log('=============')
  const rawIndexBlock = new SSTableIndexBlock()
  rawIndexBlock.append({
    key: 'key5a',
    value: Buffer.concat([
      Buffer.from(varint.encode(0)),
      Buffer.from(varint.encode(block.size))
    ])
  })
  // console.log(`rawIndexBlock size: `, rawIndexBlock.size)

  rawIndexBlock.append({
    key: 'key15a',
    value: Buffer.concat([
      Buffer.from(varint.encode(block.size)),
      Buffer.from(varint.encode(block2.size))
    ])
  })

  // console.log(`rawIndexBlock size: `, rawIndexBlock.size)

  const buf = Buffer.concat([
    block.buffer,
    block2.buffer,
    rawIndexBlock.buffer
  ])

  assert(buf.length === block.size + block2.size + rawIndexBlock.size, 'size must be equal')
  const indexBlock = new SSTableIndexBlock(buf, block.size + block2.size, rawIndexBlock.size)

  // console.log(`buf length`, buf.length)
  // console.log('indexBlock', indexBlock)

  // await fs.writeFile('./.db/sstableindexblock', indexBlock.buffer)

  console.time('iterator_data_blocks')
  let iterator = indexBlock.dataBlockIterator()
  let result = iterator.next()
  while (!result.done) {
    console.log('table iterator value: ', result.value)
    result = iterator.next()
  }
  console.timeEnd('iterator_data_blocks')
}

main()
