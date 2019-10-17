import assert from 'assert'
import Database from '../Database'
import { createDir, cleanup } from '../../fixtures/dbpath'

const dbpath = createDir()
const dbpath2 = createDir()
afterAll(() => {
  cleanup(dbpath)
  // cleanup(dbpath2)
})

describe('Database', () => {
  // test('read record from db', async () => {
  //   const db = new Database(dbpath)
  //   await db.put({}, 'key', 'world')
  //   const result = await db.get({}, 'key')
  //   expect(!!result).toBe(true)
  //   expect(result.toString()).toBe('world')
  // })

  test('recovery', async () => {
    const db = new Database(dbpath2)
    await db.put({}, 'key', 'world')

    await new Promise(resolve => setTimeout(resolve, 1000))

    const db2 = new Database(dbpath2)
    await db2.ok()

    const result = await db2.get({}, 'key')
    expect(!!result).toBe(true)
    expect(result.toString()).toBe('world')
  })
})
