import Database from '../Database'
import { random } from '../../fixtures/random'
import { createDir, cleanup } from '../../fixtures/dbpath'

const dbpath = createDir()
afterAll(() => {
  cleanup(dbpath)
})

describe('Database Iterator', () => {
  test('iterator with start option', async done => {
    const db = new Database(dbpath)
    let cacheKey = null
    for (let i = 0; i < 1000; i++) {
      const entry = random()
      if (i === 500) cacheKey = entry[0]
      await db.put(...entry)
    }

    let count = 0
    let cacheKey2 = null
    for await (const entry of db.iterator({ start: cacheKey })) {
      if (count === 0) {
        cacheKey2 = `${entry.key}`
      }
      expect(entry.key.compare(Buffer.from(cacheKey)) > 0).toBe(true)
      count++
      if (count > 10) break
    }

    await db.del(cacheKey2)
    count = 0
    for await (const entry of db.iterator({ start: cacheKey })) {
      expect(entry.key.compare(Buffer.from(cacheKey2)) !== 0).toBe(true)
      count++
      if (count > 10) break
    }
    done()
  })
})
