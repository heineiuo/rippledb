const BloomFilter = require('../build/BloomFilter').default

const filter = new BloomFilter()
console.log(filter._bitBuffer.toString())

console.log('kNumber', filter.kNumber)
const keys = ['a', 'a1']
filter.putKeys(keys, keys.length)
console.log(filter._bitBuffer.toString())

const filter2 = new BloomFilter(filter.buffer)

console.log(filter2.keyMayMatch('a'))
console.log(filter2.keyMayMatch('a1'))
console.log(filter2.keyMayMatch('xxx'))
