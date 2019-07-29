const BloomFilter = require('../build/BloomFilter').default
const SSTableMetaBlock = require('../build/SSTableMetaBlock').default

const filter = new BloomFilter()
const keys = ['a', 'a1']
filter.putKeys(keys, keys.length)

const filter2 = new BloomFilter()
const keys2 = ['b', 'b2']
filter2.putKeys(keys2, keys2.length)

const metaBlock = new SSTableMetaBlock()

metaBlock.appendFilter(filter.buffer)
metaBlock.appendFilter(filter2.buffer)

let iterator = metaBlock.iterator()
let result = iterator.next()
while (!result.done) {
  let reverseFilter = result.value
  console.log('filter test key: ', reverseFilter.keyMayMatch('a'))
  result = iterator.next()
}
