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
  await db.put('key1', 'world1')
  await db.del('key1')
  await db.compactRange(new Slice('k'), new Slice('kc'))
  // const result = await db.get({}, 'key')
  // expect(!!result).toBe(true)
  // expect(result.toString()).toBe('world')
  const result2 = await db.get({}, 'key1')
  expect(!!result2).toBe(false)
  done()
})
