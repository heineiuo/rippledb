const varint = require('varint')

function main(){
  const buf_1 = Buffer.from('我的')
  const varint_1 = varint.encode(buf_1)
  console.log(buf_1, varint_1, varint.encode.bytes)
}

main()