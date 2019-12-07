import { Database } from '../build'
import { random } from '../fixtures/random'
import { createDir } from '../fixtures/dbpath'
import fs from 'fs'
import path from 'path'
import { argv } from 'yargs'

function now(): number {
  return Number(process.hrtime.bigint()) / Math.pow(10, 6)
}

async function bench(total: number): Promise<void> {
  const dataset = []
  for (let i = 0; i < total; i++) {
    dataset.push([random(16), random(100)])
  }

  const dbpath = createDir('bench')
  const db = new Database(dbpath)

  const startTime = now()

  let count = 0
  for await (const entry of db.iterator()) {
    if (entry) count++
  }

  if (total !== count)
    throw new Error(`Data lost: except ${total} receivec ${count}`)

  const endTime = now()
  const totalTime = endTime - startTime

  const file = await fs.promises.open(
    path.resolve(__dirname, '../bench.log'),
    'a+'
  )
  const log = `
time    : ${new Date().toISOString()}
key     : 16 bytes
value   : 100 bytes
total   : ${total}
speed   : ${totalTime.toFixed(2)} ms total; ${(
    (totalTime / total) *
    1000
  ).toFixed(2)} us/op
`
  console.log(log)
  await file.appendFile(log)
  await db.destroy()
}

bench(parseInt(argv.total as string))
