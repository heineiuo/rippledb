const assert = require('assert')
const Database = require('../src/Database').default
const dbpath = require('../fixtures/dbpath')


test('read record from db', async () => {
  const db = new Database(dbpath)
  await db.put('key', 'world')
  const result = await db.get('key')
  expect(result).toBe('world')
})
