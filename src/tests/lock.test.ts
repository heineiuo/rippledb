import Database from '../Database'
import { createDir, cleanup } from '../../fixtures/dbpath'
import { Options } from '../Options'
import { StatusError } from '../Status'

jest.setTimeout(60000 * 10)

const dbpath = createDir()
afterAll(() => {
  cleanup(dbpath)
})

cleanup(dbpath)

test('lock', async () => {
  const options = new Options()
  options.debug = true
  const db1 = new Database(dbpath)
  expect(await db1.ok()).toBe(true)
  const db2 = new Database(dbpath, options)
  await expect(db2.ok()).rejects.toThrowError(/EEXIST/)
})
