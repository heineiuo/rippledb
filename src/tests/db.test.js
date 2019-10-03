import assert from 'assert'
import Database from '../Database'
import { createDir, cleanup } from '../../fixtures/dbpath'

const dbpath = createDir()
afterAll(() => cleanup(dbpath))

test('read record from db', async () => {
  const db = new Database(dbpath)
  await db.put('key', 'world')
  const result = await db.get({}, 'key')
  expect(!!result).toBe(true)
  expect(result.toString()).toBe('world')
})
