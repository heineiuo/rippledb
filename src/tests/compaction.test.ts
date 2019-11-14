import { random } from '../../fixtures/random'
import Database from '../Database'
import { createDir, cleanup } from '../../fixtures/dbpath'

jest.setTimeout(60000 * 10)

const dbpath1 = createDir()
const dbpath2 = createDir()
afterAll(() => {
  cleanup(dbpath1)
  cleanup(dbpath2)
})

cleanup(dbpath1)
cleanup(dbpath2)

describe('Compaction', () => {
  test('writelevel0', async done => {
    const db = new Database(dbpath1)
    await db.put('key', 'value1')
    await db.put('key', 'value2')
    await db.del('key')
    await db.put('key', 'value3')
    await db.put('key', 'value4')
    await db.compactRange('k', 'kz')
    done()
  })

  test('do merge', async done => {
    const db = new Database(dbpath2)
    const checkRecord = ['foo', 'bar']
    const checkIndex = Math.floor(Math.random() * 1000)
    let randomCheckRecord = []
    const randomCheckIndex = Math.floor(Math.random() * 1000)
    for (let i = 0; i < 100000; i++) {
      if (i === checkIndex) {
        await db.put('foo', 'bar')
      } else if (i === randomCheckIndex) {
        randomCheckRecord = random()
        await db.put(randomCheckRecord[0], randomCheckRecord[1])
      } else {
        const [key, value] = random()
        await db.put(key, value)
      }
    }

    const result = await db.get(checkRecord[0])
    expect(!!result).toBe(true)
    expect(`${result}`).toBe(checkRecord[1])

    await db.compactRange(
      Buffer.alloc(16).fill(0x00),
      Buffer.alloc(16).fill(0xff)
    )

    const result2 = await db.get(checkRecord[0])
    expect(!!result2).toBe(true)
    expect(`${result2}`).toBe(checkRecord[1])

    const result3 = await db.get(randomCheckRecord[0])
    expect(!!result3).toBe(true)
    expect(`${result3}`).toBe(randomCheckRecord[1])
    done()
  })
})
