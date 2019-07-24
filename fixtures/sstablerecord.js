
const SSTableRecord = require('../build/SSTableRecord').default

async function main () {
  const record = new SSTableRecord()
  record.put('key1', 'value1')
  console.log('record', record.get())
  const record2 = new SSTableRecord(record.buffer)
  console.time('sstablerecord_get')
  let data = record2.get()
  console.timeEnd('sstablerecord_get')
  console.time('sstablerecord_put')
  record2.put('key2', 'value2')
  console.timeEnd('sstablerecord_put')

  console.time('sstablerecord_buffer')
  let buf2 = record2.buffer
  console.timeEnd('sstablerecord_buffer')
}

main()
