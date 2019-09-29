import assert from 'assert'
import { createDir, cleanup } from './dbpath'
import Database from '../build/Database'
import Slice from '../build/Slice'
;(async () => {
  try {
    const dbpath = createDir()
    cleanup(dbpath)

    const db = new Database(dbpath)
    await db.put('key', 'world')
    await db.compactRange(new Slice('k'), new Slice('kc'))
    const result = await db.get('key')
    // console.log(result)
    process.exit(0)
  } catch (e) {
    console.error(e)
    // cleanup(dbpath)
    process.exit(1)
  }
})()
