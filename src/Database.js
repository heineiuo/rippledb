/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow
/* global AsyncGenerator */

import path from 'path'
// import fs from 'fs'
import MemTable from './MemTable'
import LogRecord from './LogRecord'
import LogWriter from './LogWriter'
// import LogReader from './LogReader'
import SequenceNumber from './SequenceNumber'
import LRU from 'lru-cache'
import Slice from './Slice'

class Database {
  constructor (dbpath:string) {
    this._log = new LogWriter(path.resolve(dbpath, './0001.log'))
    this._memtable = new MemTable()
    this._sn = new SequenceNumber(0)
    this._cache = LRU({
      max: 500,
      length: function (n, key) {
        return n * 2 + key.length
      },
      dispose: function (key, n) {
        n.close()
      },
      maxAge: 1000 * 60 * 60
    })

    this.recovery()
  }

  _log:LogWriter
  _memtable:MemTable

  recovery () {
    // const logReader = new LogReader()
  }

  async * iterator ():AsyncGenerator<any, void, void> {
    // await new Promise()
    // yield 'a'
  }

  async get (key:Slice):any {
    const result = this._memtable.get(key)
    return result
  }

  async put (key:Slice, value:Slice) {
    const record = LogRecord.add(key, value)
    await this._log.addRecord(record)
    // return this._cache.set(key, value)
  }

  async del (key:Slice) {
    const record = LogRecord.del(key)
    await this._log.addRecord(record)
    return this._cache.set(key)
    // return this._cache.del(key)
  }
}

export default Database
