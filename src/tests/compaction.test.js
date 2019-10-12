import assert from 'assert'
import { random } from '../../fixtures/random'
import Database from '../Database'
import { createDir, cleanup } from '../../fixtures/dbpath'
import Slice from '../Slice'

jest.setTimeout(1000 * 3600)

const dbpath2 = createDir()
afterAll(() => {
  cleanup(dbpath2)
})

cleanup(dbpath2)

describe('Compaction', () => {
  test('do merge', async done => {
    const db = new Database(dbpath2)
    for (let i = 0; i < 50000; i++) {
      await db.put({}, ...random())
    }
    await db.compactRange(
      new Slice(Buffer.alloc(16).fill(0x00)),
      new Slice(Buffer.alloc(16).fill(0xff))
    )

    done()
  })
})
