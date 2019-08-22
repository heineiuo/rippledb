/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow
/* global AsyncGenerator */

// import path from 'path'
// import fs from 'fs'
import MemTable from './MemTable'
import Log from './Log'
import SequenceNumber from './SequenceNumber'
import LRU from 'lru-cache'
import Slice from './Slice'

class Database {
  constructor (dbpath:string) {
    this._log = new Log(dbpath)
    this._mem = new MemTable()
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

  recovery () {
    this._log.readLogRecord(0)
  }

  async * iterator ():AsyncGenerator<any, void, void> {
    // await new Promise()
    // yield 'a'
  }

  async get (key:Slice) {
    return this._cache.get(key)
  }

  async put (key:Slice, value:Slice) {
    return this._cache.set(key, value)
  }

  async del (key:Slice) {
    return this._cache.del(key)
  }

  _viewLog = () => {

  }
}

export default Database
