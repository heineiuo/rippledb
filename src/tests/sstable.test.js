import fs from 'fs'
import path from 'path'
import Slice from '../Slice'
import SSTable from '../SSTable'
import SSTableBuilder from '../SSTableBuilder'
import { createDir, cleanup } from '../../fixtures/dbpath'

const dbpath = createDir()
afterAll(() => cleanup(dbpath))

function padLeft(str, total = 10) {
  if (str.length < total) {
    return padLeft(`0${str}`, total)
  }
  return str
}

function sortedKey(index) {
  return new Slice(`key${padLeft(String(index))}`)
}

function randomValue(index) {
  return new Slice(`value${padLeft(String(index))}`)
}

test('sstable', async () => {
  await fs.promises.mkdir(dbpath, { recursive: true })
  const tablePath = path.resolve(dbpath, './0001.ldb')
  // await fs.promises.writeFile(tablePath, Buffer.alloc(0))
  const file = await fs.promises.open(tablePath, 'w')
  const tableWritter = new SSTableBuilder(file)

  let i = 0
  while (i < 5000) {
    await tableWritter.add(sortedKey(i), randomValue(i))
    i++
  }

  await tableWritter.close()

  const ldbPath = path.resolve(dbpath, './0001.ldb')
  const buf = await fs.promises.readFile(ldbPath)
  const table = new SSTable(buf)
  // console.log(table._footer.get())

  let count = 0
  for (let result of table.dataBlockIterator()) {
    count++
  }
  // check this later
  // expect(count).toBe(3010)
  expect(table.get(sortedKey(1), { valueEncoding: 'string' })).toBe(
    'value0000000001'
  )
})
