import varint from 'varint'
import Slice from '../Slice'
import MemTable from '../MemTable'
import {
  LookupKey,
  ValueType,
  SequenceNumber,
  InternalKeyComparator,
} from '../Format'
import { BytewiseComparator } from '../Comparator'

test('memtable add and get', () => {
  const sequence = new SequenceNumber()
  const memtable = new MemTable(
    new InternalKeyComparator(new BytewiseComparator())
  )
  memtable.add(
    sequence,
    ValueType.kTypeValue,
    new Slice('key'),
    new Slice('key1valuevalue1')
  )
  memtable.add(
    sequence,
    ValueType.kTypeValue,
    new Slice('key2'),
    new Slice('key2valuevadfa')
  )
  memtable.add(
    sequence,
    ValueType.kTypeValue,
    new Slice('key3'),
    new Slice('key3value12389fdajj123')
  )

  const lookupkey1 = new LookupKey(new Slice('key'), sequence)
  const result = memtable.get(lookupkey1)
  expect(!!result).toBe(true)
  expect(result.buffer.toString()).toBe('key1valuevalue1')
  const lookupkey2 = new LookupKey(new Slice('key3'), sequence)
  const result2 = memtable.get(lookupkey2)
  expect(!!result2).toBe(true)
  expect(result2.buffer.toString()).toBe('key3value12389fdajj123')

  const lookupkey3 = new LookupKey(new Slice('key4'), sequence)
  memtable.add(sequence, ValueType.kTypeDeletion, new Slice('key3'))
  const result3 = memtable.get(lookupkey3)
  expect(!!result3).toBe(false)
})
