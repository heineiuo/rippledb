const varint = require('varint')

console.log(Buffer.from(varint.encode(32767)).length)
console.log(Buffer.from(varint.encode(3000)).length)
