import assert from 'assert'
import { random } from '../../fixtures/random'
import Database from '../Database'
import { createDir, cleanup } from '../../fixtures/dbpath'
import Slice from '../Slice'

const dbpath1 = createDir()
const dbpath2 = createDir()
afterAll(() => {
  cleanup(dbpath1)
  cleanup(dbpath2)
})

cleanup(dbpath1)
cleanup(dbpath2)

describe('Compaction', () => {
  test('db manual compaction', async done => {
    const db = new Database(dbpath1)
    await db.put('key', 'world')
    await db.put('key1', 'world1')
    await db.put('key', 'world2')
    await db.del('key1')
    await db.compactRange(new Slice('k'), new Slice('kc'))
    const result = await db.get({}, 'key')
    expect(!!result).toBe(true)
    expect(result.toString()).toBe('world2')
    const result2 = await db.get({}, 'key1')
    expect(!!result2).toBe(false)
    done()
  })

  test('do merge', async done => {
    const db = new Database(dbpath2)
    await db.put(...random())

    for (let i = 0; i < 10000; i++) {
      await db.put(...random())
    }
    done()
  })
})
