import { random } from '../../fixtures/random'
import Database from '../Database'
import { createDir, cleanup } from '../../fixtures/dbpath'
import Slice from '../Slice'

jest.setTimeout(60000 * 10)

const dbpath2 = createDir()
afterAll(() => {
  // cleanup(dbpath2)
})

cleanup(dbpath2)

describe('Compaction', () => {
  test('do merge', async done => {
    const db = new Database(dbpath2)
    const checkRecord = ['foo', 'bar']
    const checkIndex = Math.floor(Math.random() * 100)
    for (let i = 0; i < 100000; i++) {
      if (i === checkIndex) {
        await db.put({}, 'foo', 'bar')
      } else {
        await db.put({}, ...random())
      }
    }

    const result = await db.get({}, checkRecord[0])
    expect(!!result).toBe(true)
    expect(result.toString()).toBe(checkRecord[1])

    await db.compactRange(
      new Slice(Buffer.alloc(16).fill(0x00)),
      new Slice(Buffer.alloc(16).fill(0xff))
    )

    done()

    // const result2 = await db.get({}, checkRecord[0])
    // expect(!!result2).toBe(true)
    // expect(result2.toString()).toBe(checkRecord[1])
  })
})
