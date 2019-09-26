import assert from 'assert'
import Database from '../Database'
import dbpath from '../../fixtures/dbpath'
import Slice from '../Slice'

test('db manual compaction', async () => {
  const db = new Database(dbpath)
  await db.put('key', 'world')
  await db.compactRange(new Slice('k'), new Slice('kc'))
  const result = await db.get('key')
  expect(result).toBe('world')
})
