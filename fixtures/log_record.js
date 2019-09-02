const LogRecord = require('../build/LogRecord').default
const RecordType = require('../build/Format').RecordType
const Slice = require('../build/Slice').default

async function main () {
  console.time('create_log')
  const record1 = new LogRecord(RecordType.kFirstType, new Slice('hello'))
  console.timeEnd('create_log')
  console.time('read_log')
  const record2 = LogRecord.from(record1.buffer)
  console.timeEnd('read_log')
  console.log(record2.data)
  console.log(record2.type)
}

main()
