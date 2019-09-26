import assert from 'assert'
import dbpath from './dbpath'
import Database from '../build/Database'
import Slice from '../build/Slice'
;(async () => {
  try {
    const db = new Database(dbpath)
    await db.put('key', 'world')
    await db.compactRange(new Slice('k'), new Slice('kc'))
    const result = await db.get('key')
    console.log(result)
    process.exit(0)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
})()
