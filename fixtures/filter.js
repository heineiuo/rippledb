const MurmurHash3 = require('../build/MurmurHash3').default
// const filter = new BloomFilter()
var seed1 = Math.floor(Math.random() * 2e32)
var seed2 = Math.floor(Math.random() * 2e31)
console.log(MurmurHash3(String(Buffer.from(['kadff'])), seed1) % 15)
console.log(MurmurHash3('kadff', seed2) % 15)
console.log(MurmurHash3('adf132', seed1) % 15)
console.log(MurmurHash3('afdjkalg', seed1) % 15)
console.log(MurmurHash3('kakldf', seed1) % 15)
