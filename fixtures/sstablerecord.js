
const SSTableRecord = require('../build/SSTableRecord').default

async function main () {
  const record = new SSTableRecord({
    key: 'key1',
    value: 'value1'
  })
  const buf = record.toBuffer()
  console.log('record.key', record.key)
  console.log('record.value', record.value)
  console.log('buf', buf)

  const record2 = SSTableRecord.fromBuffer(buf)
  record2.value = 'value2'

  console.log('record2.key', record2.key)
  console.log('record2.value', record2.value)
}

main()
