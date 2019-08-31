const Database = require('../dist/Database').default
const dbpath = require('./dbpath')

const db = new Database(dbpath)

;(async () => {
  // console.log(db)
  await db.put('hello', 'world')

  console.log(await db.get('hello'))
})()
