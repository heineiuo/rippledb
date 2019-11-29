import { Database } from '../build'
import { random } from '../fixtures/random'
import { createDir, cleanup } from '../fixtures/dbpath'
import fs from 'fs'
import path from 'path'
import { argv } from 'yargs'
import { allocRunner } from '../fixtures/runner'

function now(): number {
  return Number(process.hrtime.bigint()) / Math.pow(10, 6)
}

async function bench(total: number, runnerCount: number): Promise<void> {
  const dataset = []
  for (let i = 0; i < total; i++) {
    const strEntry = random(16, 100)
    dataset.push([Buffer.from(strEntry[0]), Buffer.from(strEntry[1])])
  }

  const dbpath = createDir('bench')
  cleanup(dbpath)
  const db = new Database(dbpath)

  const startTime = now()

  await allocRunner(runnerCount, db, dataset)

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
runners : ${runnerCount} 
speed   : ${totalTime.toFixed(2)} ms total; ${(
    (totalTime / total) *
    1000
  ).toFixed(2)} us/op
`
  console.log(log)
  await file.appendFile(log)
}

bench(parseInt(argv.total as string), parseInt(argv.runner as string))
