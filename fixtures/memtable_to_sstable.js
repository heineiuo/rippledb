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
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key'), new Slice('key1valuevalue1'))
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key2'), new Slice('key2valuevadfa'))
  memtable.add(sequence, ValueType.kTypeValue, new Slice('key3'), new Slice('key3value12389fdajj123'))
}

main()
