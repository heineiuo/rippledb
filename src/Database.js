/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow
/* global AsyncGenerator */

import path from 'path'
// import { Buffer } from 'buffer'
import fs from 'fs'
import MemTable from './MemTable'
import LogRecord from './LogRecord'
import LogWriter from './LogWriter'
// import LogReader from './LogReader'
import { ValueType, kMemTableDumpSize, kInternalKeyComparatorName } from './Format'
import SequenceNumber from './SequenceNumber'
import LRU from 'lru-cache'
import Slice from './Slice'
import VersionSet from './VersionSet'
import VersionEdit from './VersionEdit'
import ManifestRecord from './ManifestRecord'

class Database {
  constructor (dbpath:string) {
    this._ok = false
    this._dbpath = dbpath
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

    this.recover()
  }

  _dbpath:string
  _sn:SequenceNumber
  _cache: LRU
  _log:LogWriter
  _memtable:MemTable
  _immtable: MemTable | null
  _versionSet:VersionSet
  _ok:boolean

  async existCurrent ():Promise<boolean> {
    try {
      const currentName = path.resolve(this._dbpath, './CURRENT')
      await fs.promises.access(currentName, fs.constants.R_OK)
      return true
    } catch (e) {
      return false
    }
  }

  async initVersionEdit () {
    const edit = new VersionEdit()
    edit.comparator = kInternalKeyComparatorName
    edit.logNumber = 0
    edit.nextFileNumber = 2
    edit.lastSequence = 0

    const manifestName = 'MANIFEST-000001'
    const writer = new LogWriter(path.resolve(this._dbpath, manifestName))
    await writer.addRecord(ManifestRecord.add(edit))
    await writer.close()
    await fs.promises.writeFile(path.resolve(this._dbpath, './CURRENT'), manifestName + '\n')
  }

  async recover () {
    // const logReader = new LogReader()
    if (!await this.existCurrent()) {
      await this.initVersionEdit()
    }
    this._versionSet = new VersionSet()
    this._versionSet.recover()
    this._ok = true
  }

  async recoverLogFile () {

  }

  async ok () {
    if (this._ok) return true
    let limit = 5
    let i = 0
    while (i < limit) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (this._ok) return true
      i++
    }
    throw new Error('Database is busy.')
  }

  async * iterator ():AsyncGenerator<any, void, void> {
    await this.ok()
    // await new Promise()
    // yield 'a'
  }

  /**
   * TODO 触发compaction
   * 1. manually compact
   * 2. 超过allowed_seeks
   * 3. level0 sstable 超过8个
   * 4. leveli(i>0)层sstable占用空间超过10^iMB
   */
  async get (key:Slice):any {
    await this.ok()
    const result = this._memtable.get(key)
    return result
  }

  /**
   * TODO
   * 1. 检查memtable是否超过4mb
   * 2. 检查this._immtable是否为null（memtable转sstable）
   */
  async put (key:Slice, value:Slice) {
    await this.ok()
    console.log('memtable size is: ', this._memtable.size)
    const record = LogRecord.add(key, value)
    await this._log.addRecord(record)
    this._memtable.add(this._sn, ValueType.kTypeValue, key, value)
    if (this._memtable.size >= kMemTableDumpSize) {
      this.dumpMemTable()
    }
    // return this._cache.set(key, value)
  }

  async del (key:Slice) {
    await this.ok()
    const record = LogRecord.del(key)
    await this._log.addRecord(record)
    this._cache.set(key)
    this._memtable.add(this._sn, ValueType.kTypeDeletionkey, key, new Slice())
    // return this._cache.del(key)
  }

  dumpMemTable () {
    const memtable = this._memtable
    this._memtable = null
    this._memtable.immutable = true
  }

  /**
   * manually compact
   */
  compactRange () {

  }
}

export default Database
