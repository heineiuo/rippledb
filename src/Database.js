/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow
/* global AsyncGenerator */

// import { Buffer } from 'buffer'
import assert from 'assert'
import fs from 'fs'
import MemTable from './MemTable'
// import LogRecord from './LogRecord'
import LogWriter from './LogWriter'
import { type Options } from './Options'
import { ValueType, kMemTableDumpSize, kInternalKeyComparatorName } from './Format'
import { InternalKeyComparator } from './VersionFormat'
import SequenceNumber from './SequenceNumber'
import LRU from 'lru-cache'
import Slice from './Slice'
import VersionSet from './VersionSet'
import VersionEdit from './VersionEdit'
import VersionEditRecord from './VersionEditRecord'
import { getCurrentFilename, getLogFilename, getManifestFilename } from './Filename'
import WriteBatch from './WriteBatch'

export default class Database {
  _internalKeyComparator: InternalKeyComparator
  _backgroundCompactionScheduled: boolean
  _dbpath:string
  _sn:SequenceNumber
  _cache: LRU
  _log:LogWriter
  _memtable:MemTable
  _immtable: MemTable | null
  _versionSet:VersionSet
  _ok:boolean

  constructor (dbpath:string) {
    this._backgroundCompactionScheduled = false
    this._internalKeyComparator = new InternalKeyComparator()
    this._ok = false
    this._dbpath = dbpath
    this._log = new LogWriter(getLogFilename(dbpath, 1))
    this._memtable = new MemTable(this._internalKeyComparator)
    this._sn = new SequenceNumber(0)
    this._cache = new LRU({
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

  async existCurrent ():Promise<boolean> {
    try {
      const currentName = getCurrentFilename(this._dbpath)
      try {
        await fs.promises.access(this._dbpath, fs.constants.W_OK)
      } catch (e) {
        await fs.promises.mkdir(this._dbpath, { recursive: true })
        return false
      }
      await fs.promises.access(currentName, fs.constants.W_OK)
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
    console.log('initVersionEdit', edit)
    const writer = new LogWriter(getManifestFilename(this._dbpath, 1))
    await writer.addRecord(VersionEditRecord.add(edit))
    await writer.close()
    await fs.promises.writeFile(getCurrentFilename(this._dbpath), 'MANIFEST-000001\n')
  }

  async recover () {
    // const logReader = new LogReader()
    if (!await this.existCurrent()) {
      await this.initVersionEdit()
    }
    this._versionSet = new VersionSet(
      this._dbpath, {}, this._memtable, this._internalKeyComparator
    )
    await this._versionSet.recover()
    this._ok = true
  }

  async recoverLogFile () {

  }

  // wait for db.recover
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

  async * iterator (options: Options):AsyncGenerator<any, void, void> {
    await this.ok()
    for (let key in this._memtable.iterator()) {
      yield key
    }
    // await new Promise()
    // yield 'a'
  }

  /**
   * TODO 触发major compaction
   * 1. manually compact
   * 2. 超过allowed_seeks
   * 3. level0 sstable 超过8个
   * 4. leveli(i>0)层sstable占用空间超过10^iMB
   */
  async get (key:any, options?:Options):any {
    await this.ok()
    const sliceKey = new Slice(key)
    const lookupKey = MemTable.createLookupKey(this._sn, sliceKey, ValueType.kTypeValue)
    const result = this._memtable.get(lookupKey, options)
    return result
  }

  /**
   * TODO 触发minor compaction
   * 1. 检查memtable是否超过4mb
   * 2. 检查this._immtable是否为null（memtable转sstable）
   */
  async put (key:any, value:any, options?:Options) {
    const batch = new WriteBatch()
    batch.put(new Slice(key), new Slice(value))
    await this.write(batch, options)
  }

  async del (key:any, options?:Options) {
    const batch = new WriteBatch()
    batch.del(new Slice(key))
    await this.write(batch, options)
  }

  async write (batch:WriteBatch, options?:Options) {
    await this.ok()
    this.makeRoomForWrite()
    const lastSequence = this._versionSet.lastSequence

    // await this._log.addRecord(LogRecord.add(sliceKey, sliceValue))
    // await this._log.addRecord(LogRecord.del(sliceKey))
    WriteBatch.insert(batch, this._memtable)
    console.log('insert to memtable success')
    WriteBatch.setSequence(batch, lastSequence + 1)

    // this._memtable.add(this._sn, ValueType.kTypeValue, sliceKey, sliceValue)
    // console.log('memtable size is: ', this._memtable.size)
  }

  makeRoomForWrite () {
    if (this._memtable.size >= kMemTableDumpSize) {
      assert(this._versionSet.logNumber === 0) // no logfile is compaction
      const newLogNumber = this._versionSet.getNextFileNumber()
      this._log = new LogWriter(getLogFilename(newLogNumber))
      this._immtable = this._memtable
      this._memtable = new MemTable(this._internalKeyComparator)
      this._memtable.ref()
      this.backgroundCompaction()
    }
  }

  async backgroundCompaction () {
    try {
      this._backgroundCompactionScheduled = true
      if (this._immtable !== null) {
        await this.compactMemTable()
        await this.backgroundCompaction()
        return
      }
      if (!this._versionSet.needsCompaction()) {
      }
    } catch (e) {

    } finally {
      this._backgroundCompactionScheduled = false
    }
  }

  async compactMemTable () {

  }

  /**
   * manually compact
   */
  compactRange () {

  }
}
