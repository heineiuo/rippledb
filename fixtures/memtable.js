const varint = require('varint')
const assert = require('assert')
const Slice = require('../build/Slice').default
const MemTable = require('../build/MemTable').default
const ValueType = require('../build/Format').ValueType
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
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key'), new Slice('key1valuevalue1'))
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key2'), new Slice('key2valuevadfa'))
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key3'), new Slice('key3value12389fdajj123'))

  const lookupkey1 = createLookupKey(sequence, new Slice('key'), ValueType.kTypeValue)
  console.time('find key')
  const result = memtable.get(lookupkey1)
  console.timeEnd('find key')
  console.log(result)
  const lookupkey2 = createLookupKey(sequence, new Slice('key3'), ValueType.kTypeValue)
  console.time('find key')
  memtable.get(lookupkey2)
  console.timeEnd('find key')
  const lookupkey3 = createLookupKey(sequence, new Slice('key4'), ValueType.kTypeValue)
  console.time('find key')
  memtable.get(lookupkey3)
  memtable.add(sequence, ValueType.kTypeDeletion, new Slice('key3'))

  // console.log(memtable.get(lookupkey3))
  assert(memtable.get(lookupkey3) === null)
  console.timeEnd('find key')

  console.time('iterator')
  for (let value of memtable.iterator()) {
    console.log(value)
  }
  console.timeEnd('iterator')
}

main()
