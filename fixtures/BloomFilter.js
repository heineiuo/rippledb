const BloomFilter = require('../build/BloomFilter').default

const filter = new BloomFilter()
console.log(filter._bitBuffer.toString())

console.log('kNumber', filter.kNumber)
const keys = ['a', 'a1']
filter.putKeys(keys, keys.length)
console.log(filter._bitBuffer.toString())

console.log(filter.keyMayMatch('a'))
console.log(filter.keyMayMatch('a1'))
console.log(filter.keyMayMatch('xxx'))
