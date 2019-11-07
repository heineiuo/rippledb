import Database from '../Database'
import { Options } from '../Options'
import { random } from '../../fixtures/random'
import { createDir, cleanup } from '../../fixtures/dbpath'
import WriteBatch from '../WriteBatch'

const dbpath = createDir()
afterAll(() => {
  cleanup(dbpath)
})

describe('WriteBatch', () => {
  test('batch', async done => {
    const debugOptions = new Options()
    debugOptions.debug = true

    const db = new Database(dbpath)
    const batch = new WriteBatch()
    let delKey = null
    let getKey = null
    for (let i = 0; i < 100; i++) {
      const entry = random()
      if (i === 50) delKey = entry[0]
      if (i === 51) getKey = entry[0]
      batch.put(entry[0], entry[1])
    }
    batch.del(delKey)

    await db.batch(batch)

    expect(!!(await db.get(getKey))).toBe(true)
    expect(!!(await db.get(delKey))).toBe(false)

    done()
  })
})
