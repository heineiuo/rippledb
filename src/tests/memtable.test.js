import varint from 'varint'
import Slice from '../Slice'
import MemTable from '../MemTable'
import { ValueType } from '../Format'
import SequenceNumber from '../SequenceNumber'
import { InternalKeyComparator } from '../VersionFormat'

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
  const result = memtable.get(lookupkey1)
  expect(result).toBe('key1valuevalue1')
  const lookupkey2 = createLookupKey(sequence, new Slice('key3'), ValueType.kTypeValue)
  expect(memtable.get(lookupkey2)).toBe('key3value12389fdajj123')

  const lookupkey3 = createLookupKey(sequence, new Slice('key4'), ValueType.kTypeValue)
  memtable.get(lookupkey3)
  memtable.add(sequence, ValueType.kTypeDeletion, new Slice('key3'))

  expect(memtable.get(lookupkey3)).toBe(null)
})
