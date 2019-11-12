import Database from '../Database'
import { Options } from '../Options'
import { random } from '../../fixtures/random'
import { createDir, cleanup } from '../../fixtures/dbpath'

jest.setTimeout(60000 * 10)

const dbpath = createDir()
const dbpath2 = createDir()
afterAll(() => {
  cleanup(dbpath)
  cleanup(dbpath2)
})

describe('Database', () => {
  test('read record from db', async done => {
    const db = new Database(dbpath)
    await db.put('key', 'world')
    const result = await db.get('key')
    expect(!!result).toBe(true)
    expect(`${result}`).toBe('world')
    done()
  })

  test('recovery', async done => {
    const debugOptions = new Options()
    debugOptions.debug = true

    const db = new Database(dbpath2)
    await db.ok()
    await db.put('key', 'world')

    await new Promise(resolve => setTimeout(resolve, 500))
    const db2 = new Database(dbpath2)
    await db2.ok()
    await db2.put('key', 'world')

    await new Promise(resolve => setTimeout(resolve, 500))
    const db3 = new Database(dbpath2, debugOptions)
    await db3.ok()
    for (let i = 0; i < 1000; i++) {
      const [key, value] = random()
      await db3.put(key, value)
    }
    await db3.put('key', 'world')

    await new Promise(resolve => setTimeout(resolve, 500))
    const db4 = new Database(dbpath2, debugOptions)
    await db4.ok()
    await db4.put('key', 'world')

    const result = await db4.get('key')
    expect(!!result).toBe(true)
    expect(`${result}`).toBe('world')

    done()
  })
})
