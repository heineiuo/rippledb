const LogRecord = require('../build/LogRecord').default
const RecordType = require('../build/Format').RecordType
const Slice = require('../build/Slice').default

function main () {
  const record1 = new LogRecord(RecordType.kFirstType, new Slice('hello'))
  const record2 = LogRecord.from(record1.buffer)
  console.log(record2.data)
  console.log(record2.type)
}

main()
