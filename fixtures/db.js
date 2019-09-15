const assert = require('assert')
const Database = require('../src/Database').default
const dbpath = require('./dbpath')

const db = new Database(dbpath)

async function main () {
  try {
    // console.log(db)
    console.time('db')
    await db.put('key', 'world')

    const result = await db.get('key')
    assert(result === 'world')
    console.timeEnd('db')
  } catch (e) {
    console.log(e)
  }
}

main()
