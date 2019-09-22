import dbpath from '../../fixtures/dbpath'
import LogReader from '../LogReader'
import LogWriter from '../LogWriter'
import LogRecord from '../LogRecord'
import { getLogFilename } from '../Filename'
import Slice from '../Slice'
import path from 'path'

test('log writer', async () => {
  const logFilename = getLogFilename(dbpath, 1)
  const log = new LogWriter(logFilename)
  // await log.add(new Slice(`key${i}`), new Slice(`value${i}`))
  // max block sisze = 32768
  const slice = LogRecord.add(
    new Slice(`key000001`),
    new Slice(Buffer.alloc(65500))
  )
  await log.addRecord(slice)
  await log.close()

  const logReader = new LogReader(logFilename)
  for await (let slice of logReader.iterator()) {
    const op = LogRecord.decode(slice)
    const strKey = op.key.toString()
    const strValue = op.value.buffer
    expect(op.key.toString()).toBe('key000001')
  }

  // await logReader.close()
})
