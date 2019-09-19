import assert from 'assert'
import Database from '../Database'
import dbpath from '../../fixtures/dbpath'

test('read record from db', async () => {
  const db = new Database(dbpath)
  await db.put('key', 'world')
  const result = await db.get('key')
  expect(result).toBe('world')
})
