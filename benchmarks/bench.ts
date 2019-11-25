import { Database } from '../build'
import { random } from '../fixtures/random'
import { createDir, cleanup } from '../fixtures/dbpath'
import fs from 'fs'
import path from 'path'

function now(): number {
  return Number(process.hrtime.bigint()) / Math.pow(10, 6)
}

async function runner(
  db: Database,
  dataset: [string, string][],
  skip: number,
  start: number
): Promise<void> {
  let current = start
  const total = dataset.length
  while (true) {
    if (current >= total) return
    const entry = dataset[current]
    await db.put(entry[0], entry[1])
    current += skip
  }
}

async function bench(total: number, runnerCount: number): Promise<void> {
  const dataset = []
  for (let i = 0; i < total; i++) {
    dataset.push([random(16), random(100)])
  }

  const dbpath = createDir('bench')
  cleanup(dbpath)
  const db = new Database(dbpath)

  const startTime = now()
  await Promise.all(
    Array.from({ length: runnerCount }, (v, start) => {
      return runner(db, dataset, runnerCount, start)
    })
  )

  const endTime = now()
  const totalTime = endTime - startTime

  const file = await fs.promises.open(
    path.resolve(__dirname, '../bench.log'),
    'a+'
  )
  await file.appendFile(`
time    : ${new Date().toISOString()}
key     : 16 bytes
value   : 100 bytes
total   : ${total}
runners : ${runnerCount} 
speed   : ${totalTime.toFixed(2)} ms total; ${(
    (totalTime / total) *
    1000
  ).toFixed(2)} us/op
`)
}

bench(100000, 5)
