import Database from '../Database'
import { createDir, cleanup } from '../../fixtures/dbpath'
import { Options } from '../Options'
import { copydb } from '../../fixtures/copydb'

jest.setTimeout(60000 * 10)

const dbpath = createDir()
const dbpath3 = createDir()
afterAll(() => {
  cleanup(dbpath)
  cleanup(dbpath3)
})

cleanup(dbpath)

test('lock', async done => {
  const options = new Options()
  options.debug = true
  const db1 = new Database(dbpath)
  expect(await db1.ok()).toBe(true)
  const db2 = new Database(dbpath, options)
  await expect(db2.ok()).rejects.toThrowError(/EEXIST/)
  await copydb(dbpath, dbpath3)
  const db3 = new Database(dbpath3, options)
  await expect(db3.ok()).resolves.toBe(true)
  done()
})
