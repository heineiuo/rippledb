const path = require('path')
const LogReader = require('../build/LogReader').default
const LogWriter = require('../build/LogWriter').default
const ManifestRecord = require('../build/ManifestRecord').default
const VersionEdit = require('../build/VersionEdit').default

async function main () {
  await write()
  await read()
}

async function write () {
  const version = new VersionEdit()
  version.comparator = 'aaa'
  version.logNumber = 100
  const writer = new LogWriter(path.resolve(__dirname, '../.db/MANIFEST-0012'))
  await writer.addRecord(ManifestRecord.add(version))
  await writer.close()
}

async function read () {
  const reader = new LogReader(path.resolve(__dirname, '../.db/MANIFEST-0012'), ManifestRecord)
  for await (let op of reader.iterator()) {
    console.log(op)
  }
}

main()
