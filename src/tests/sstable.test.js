import fs from 'fs'
import path from 'path'
import Slice from '../Slice'
import SSTable from '../SSTable'
import SSTableBuilder from '../SSTableBuilder'
import { getTableFilename } from '../Filename'
import { createDir, cleanup } from '../../fixtures/dbpath'
import { Options } from '../Options'

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

function sortedValue(index) {
  return new Slice(`value${padLeft(String(index))}`)
}

test('sstable', async () => {
  await fs.promises.mkdir(dbpath, { recursive: true })
  const file = await fs.promises.open(getTableFilename(dbpath, 1), 'w')
  const builder = new SSTableBuilder(file, new Options())

  let i = 0
  while (i < 5000) {
    await builder.add(sortedKey(i), sortedKey(i))
    i++
  }

  await builder.finish()
  return
  console.log(builder._footer.get())

  const buf = await fs.promises.readFile(getTableFilename(dbpath, 1))
  const table = new SSTable(buf)
  // console.log(table._footer.get())

  let count = 0
  for (let result of table.entryIterator()) {
    count++
  }
  console.log(table.footer)
  // check this later
  expect(count).toBe(5000)
  expect(table.get(sortedKey(1))).toBe(sortedValue(1))
})
