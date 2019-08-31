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

function getValueFromMemtableKey (key) {
  const internalKeySize = varint.decode(key)
  const valueBuffer = key.buffer.slice(internalKeySize)
  const valueSize = varint.decode(valueBuffer)
  const value = valueBuffer.slice(valueSize)
  return value.toString()
}

function main () {
  const sequence = new SequenceNumber()
  const memtable = new MemTable()
  const key = new Slice('key')
  const value = new Slice('value123')
  memtable.add(sequence, ValueType.kTypeValue, key, value)
  const lookupkey = createLookupKey(sequence, key, ValueType.kTypeValue)
  const result = memtable.get(lookupkey)
  console.log(getValueFromMemtableKey(result))
}

main()
