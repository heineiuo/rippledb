const BitBuffer = require('../build/BitBuffer').default

const arr1 = new BitBuffer(Buffer.from({ length: Math.ceil(32 / 8) }))
arr1.set(20, true)
arr1.set(35, true)
arr1.set(40, false)

console.log('arr1 20', arr1.get(20))
console.log('arr1 35', arr1.get(35))
console.log('arr1 buffer', arr1.buffer)
console.log('arr1 buffer size', arr1.size)

const arr2 = new BitBuffer(arr1.buffer)

console.log('arr2 20', arr2.get(20))
console.log('arr2 40', arr2.get(40))
console.log('arr2 50', arr2.get(50))
