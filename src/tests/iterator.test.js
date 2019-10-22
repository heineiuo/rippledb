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
    for (let i = 0; i < 1000; i++) {
      await db.put(...random())
    }

    for await (const entry of db.iterator({ start: 'fff' })) {
      expect(entry.key.compare(Buffer.from('fff')) > 0).toBe(true)
    }
    done()
  })
})
