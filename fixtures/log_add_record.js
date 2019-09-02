const path = require('path')
const Log = require('../build/Log').default
const Slice = require('../build/Slice').default

async function main () {
  const log = new Log(path.resolve(__dirname, '../.db/LOG'))
  await log.add(new Slice('key1'), new Slice('value1'))
}

main()
