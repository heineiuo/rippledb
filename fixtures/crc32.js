const crc32 = require('buffer-crc32')

console.log(crc32(Buffer.alloc(32768)).length)
