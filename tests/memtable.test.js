const varint = require('varint')
const assert = require('assert')
const Slice = require('../src/Slice').default
const MemTable = require('../src/MemTable').default
const ValueType = require('../src/Format').ValueType
const SequenceNumber = require('../src/SequenceNumber').default
const InternalKeyComparator = require('../src/VersionFormat').InternalKeyComparator

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

test('memtable add and get', () => {
  const sequence = new SequenceNumber()
  const memtable = new MemTable(new InternalKeyComparator())
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key'), new Slice('key1valuevalue1'))
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key2'), new Slice('key2valuevadfa'))
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key3'), new Slice('key3value12389fdajj123'))

  const lookupkey1 = createLookupKey(sequence, new Slice('key'), ValueType.kTypeValue)
  console.time('find key')
  const result = memtable.get(lookupkey1)
  expect(result).toBe('key1valuevalue1')
  const lookupkey2 = createLookupKey(sequence, new Slice('key3'), ValueType.kTypeValue)
  expect(memtable.get(lookupkey2)).toBe('key3value12389fdajj123')

  const lookupkey3 = createLookupKey(sequence, new Slice('key4'), ValueType.kTypeValue)
  memtable.get(lookupkey3)
  memtable.add(sequence, ValueType.kTypeDeletion, new Slice('key3'))

  expect(memtable.get(lookupkey3)).toBe(null)
})
