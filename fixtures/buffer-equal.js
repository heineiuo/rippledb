const { isEqual } = require('lodash')
const bufferEqual = require('buffer-equal')

function bufferEqualWrapper(a, b) {
  if (!(Buffer.isBuffer(a) && Buffer.isBuffer(b))) return a === b
  return bufferEqual(a, b)
}

; (async () => {

  const buf1 = Buffer.from('test')
  const buf2 = Buffer.from('test')
  const buf3 = 'test'

  console.time('lodash.isEqual')
  let i = 10000
  while (i > 0) {
    i--
    isEqual(buf1, buf2)
    isEqual(buf1, buf3)
  }

  console.timeEnd('lodash.isEqual')

  i = 10000

  console.time('buffer-equal')

  while (i > 0) {
    i--
    bufferEqualWrapper(buf1, buf2)
    bufferEqualWrapper(buf1, buf3)
  }
  console.timeEnd('buffer-equal')

})()


// ➜ node fixtures/buffer-equal.js
// lodash.isEqual: 37.903ms
// buffer-equal: 9.999ms