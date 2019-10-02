import BloomFilter from '../BloomFilter'

test('bloom filter', () => {
  const filter = new BloomFilter()
  expect(filter._bitBuffer.toString()).toBe('00000000')
  expect(filter.kNumber).toBe(7)

  const keys = ['a', 'a1']

  filter.putKeys(keys, keys.length)

  expect(filter._bitBuffer.toString()).toBe(
    '000000000010010010000010000000000010100100100010000000000010001001000010'
  )

  const filter2 = new BloomFilter(filter.buffer)

  expect(filter2.keyMayMatch('a')).toBe(true)
  expect(filter2.keyMayMatch('a1')).toBe(true)
  expect(filter2.keyMayMatch('xxx')).toBe(false)
})
