import assert from 'assert'
import Database from '../Database'
import { createDir, cleanup } from '../../fixtures/dbpath'

const dbpath = createDir()
const dbpath2 = createDir()
afterAll(() => {
  cleanup(dbpath)
  cleanup(dbpath2)
})

describe('Database', () => {
  test('read record from db', async () => {
    const db = new Database(dbpath)
    await db.put('key', 'world')
    const result = await db.get('key')
    expect(!!result).toBe(true)
    expect(result.toString()).toBe('world')
  })

  test('recovery', async () => {
    const db = new Database(dbpath2)
    await db.ok()
    await db.put('key', 'world')

    await new Promise(resolve => setTimeout(resolve, 500))

    const db2 = new Database(dbpath2)
    await db2.ok()
    await db2.put('key', 'world')

    await new Promise(resolve => setTimeout(resolve, 500))

    const db3 = new Database(dbpath2)
    await db3.ok()
    await db3.put('key', 'world')

    await new Promise(resolve => setTimeout(resolve, 500))

    const db4 = new Database(dbpath2)
    await db4.ok()
    await db4.put('key', 'world')

    const result = await db4.get('key')
    expect(!!result).toBe(true)
    expect(result.toString()).toBe('world')
  })
})
