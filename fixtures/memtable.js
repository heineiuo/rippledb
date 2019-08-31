const varint = require('varint')
const Slice = require('../build/Slice').default
const MemTable = require('../build/MemTable').default
const ValueType = require('../build/MemTable').ValueType
const SequenceNumber = require('../build/SequenceNumber').default

function createLookupKey (sequence, key, valueType) {
  const keySize = key.size
  const internalKeySize = keySize + 8
  const internalKeySizeBuf = Buffer.from(varint.encode(internalKeySize))
  const buf = Buffer.concat([
    internalKeySizeBuf,
    key.buffer,
    sequence.toFixedSizeBuffer(),
    Buffer.from(varint.encode(valueType.value))
  ])
  return new Slice(buf)
}

function main () {
  const sequence = new SequenceNumber()
  const memtable = new MemTable()
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key'), new Slice('value1'))
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key2'), new Slice('vadfa'))
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key3'), new Slice('vadfa'))

  const lookupkey1 = createLookupKey(sequence, new Slice('key'), ValueType.kTypeValue)
  console.time('find key')
  const result = memtable.get(lookupkey1)
  console.timeEnd('find key')
  console.log(MemTable.getValueSlice(result).toString())
  const lookupkey2 = createLookupKey(sequence, new Slice('key3'), ValueType.kTypeValue)
  console.time('find key')
  memtable.get(lookupkey2)
  console.timeEnd('find key')
  const lookupkey3 = createLookupKey(sequence, new Slice('key4'), ValueType.kTypeValue)
  console.time('find key')
  memtable.get(lookupkey3)
  console.timeEnd('find key')
}

main()
