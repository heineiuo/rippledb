import path from 'path'
import fs from 'fs'
import MemTable from './MemTable'
import Log from './Log'
import SequenceNumber from './SequenceNumber'
import LRU from 'lru-cache'

class Database {
  constructor(dbpath) {
    this._log = new Log(dbpath)
    this._mem = new MemTable()
    this._cache = LRU({
      max: 500,
      length: function (n, key) {
        return n * 2 + key.length
      },
      dispose: function (key, n) {
        n.close()
      },
      maxAge: 1000 * 60 * 60,
    })

    this.recovery()
  }

  recovery() {
    this._log.readLogRecord(0)
  }

  async get(key) {
    return this._cache.get(key)
  }

  async put(key, value) {
    return this._cache.set(key, value)
  }

  async del(key) {
    return this._cache.del(key)
  }

  createReadStream() {

  }

  _viewLog = () => {

  }

}


export default Database