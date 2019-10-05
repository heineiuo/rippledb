import assert from 'assert'
import Database from '../Database'
import { createDir, cleanup } from '../../fixtures/dbpath'
import Slice from '../Slice'

const dbpath = createDir()
afterAll(() => cleanup(dbpath))

cleanup(dbpath)

test('db manual compaction', async done => {
  const db = new Database(dbpath)
  await db.put('key', 'world')
  await db.compactRange(new Slice('k'), new Slice('kc'))
  const result = await db.get({}, 'key')
  expect(!!result).toBe(true)
  expect(result.toString()).toBe('world')
  done()
})
