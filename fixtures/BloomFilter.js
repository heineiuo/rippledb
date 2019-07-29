const BloomFilter = require('../build/BloomFilter').default

const filter = new BloomFilter()
console.log('filter bits: ', filter._bitBuffer.toString())

console.log('kNumber: ', filter.kNumber)
const keys = ['a', 'a1']
console.log('keys: ', keys.join(', '))
filter.putKeys(keys, keys.length)
console.log('filter bits: ', filter._bitBuffer.toString())

const filter2 = new BloomFilter(filter.buffer)

console.log('a: ', filter2.keyMayMatch('a'))
console.log('a1: ', filter2.keyMayMatch('a1'))
console.log('xxx: ', filter2.keyMayMatch('xxx'))
