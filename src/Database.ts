/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Buffer } from 'buffer'
import path from 'path'
import assert from 'assert'
import fs from 'fs'
import MemTable from './MemTable'
import LogRecord from './LogRecord'
import LogWriter from './LogWriter'
import { EncodingOptions } from './Options'
import {
  ValueType,
  kMemTableDumpSize,
  kInternalKeyComparatorName,
  Config,
  FileType,
} from './Format'
import {
  InternalKeyComparator,
  InternalKey,
  FileMetaData,
} from './VersionFormat'
import SequenceNumber from './SequenceNumber'
import LRU from 'lru-cache'
import Compaction, { CompactionState } from './Compaction'
import Slice from './Slice'
import VersionSet from './VersionSet'
import VersionEdit from './VersionEdit'
import VersionEditRecord from './VersionEditRecord'
import {
  parseFilename,
  getCurrentFilename,
  getLogFilename,
  getManifestFilename,
} from './Filename'
import WriteBatch from './WriteBatch'
import Status from './Status'

interface ManualCompaction {
  level: number
  done: boolean
  begin: InternalKey // null means beginning of key range
  end: InternalKey // null means end of key range
  tmpStorage: InternalKey
}

export default class Database {
  private _internalKeyComparator: InternalKeyComparator
  private _backgroundCompactionScheduled: boolean
  private _dbpath: string
  private _sn: SequenceNumber
  // _cache: LRU
  private _log: LogWriter
  private _logFileNumber!: number
  private _memtable: MemTable
  private _immtable?: MemTable
  private _versionSet: VersionSet
  private _ok: boolean
  private _manualCompaction!: ManualCompaction | null
  private _bgError!: Status
  private pendingOutputs!: number[]
  private snapshots!: number[]

  constructor(dbpath: string) {
    this._backgroundCompactionScheduled = false
    this._internalKeyComparator = new InternalKeyComparator()
    this._ok = false
    this._dbpath = dbpath
    this._log = new LogWriter(getLogFilename(dbpath, 1))
    this._memtable = new MemTable(this._internalKeyComparator)
    this._sn = new SequenceNumber(0)
    this.pendingOutputs = []

    this._versionSet = new VersionSet(
      this._dbpath,
      {
        maxFileSize: 1024 * 1024 * 2,
      },
      this._memtable,
      this._internalKeyComparator
    )

    // this._cache = new LRU({
    //   max: 500,
    //   length: function (n:number, key:string) {
    //     return n * 2 + key.length
    //   },
    //   dispose: function (key, n) {
    //     // n.close()
    //   },
    //   maxAge: 1000 * 60 * 60
    // })

    this.recover()
  }

  private async existCurrent(): Promise<boolean> {
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

  private async initVersionEdit(): Promise<void> {
    const edit = new VersionEdit()
    edit.comparator = kInternalKeyComparatorName
    edit.logNumber = 0
    edit.nextFileNumber = 2
    edit.lastSequence = 0
    // console.log('initVersionEdit', edit)
    const writer = new LogWriter(getManifestFilename(this._dbpath, 1))
    await writer.addRecord(VersionEditRecord.add(edit))
    await writer.close()
    await fs.promises.writeFile(
      getCurrentFilename(this._dbpath),
      'MANIFEST-000001\n'
    )
  }

  private async recover(): Promise<void> {
    if (!(await this.existCurrent())) {
      await this.initVersionEdit()
    }

    await this._versionSet.recover()
    this._ok = true
  }

  private async recoverLogFile() {}

  // wait for db.recover
  private async ok() {
    if (this._ok) return true
    let limit = 5
    let i = 0
    while (i < limit) {
      await new Promise(resolve => setTimeout(resolve, 100))
      if (this._ok) return true
      i++
    }
    throw new Error('Database is busy.')
  }

  async *iterator(options?: EncodingOptions) {
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
  async get(key: any, options?: EncodingOptions): Promise<any> {
    await this.ok()
    // console.log('get ok')
    const sliceKey = new Slice(key)
    // console.log('sliceKey', sliceKey)
    const lookupKey = MemTable.createLookupKey(
      this._sn,
      sliceKey,
      ValueType.kTypeValue
    )

    this._memtable.ref()
    if (!!this._immtable) this._immtable.ref()
    this._versionSet.current.ref()

    let result = this._memtable.get(lookupKey, options)
    if (!result && !!this._immtable) {
      result = this._immtable.get(lookupKey, options)
    }
    return result
  }

  /**
   * TODO 触发minor compaction
   * 1. 检查memtable是否超过4mb
   * 2. 检查this._immtable是否为null（memtable转sstable）
   */
  async put(key: any, value: any, options?: EncodingOptions) {
    const batch = new WriteBatch()
    batch.put(new Slice(key), new Slice(value))
    await this.write(batch, options)
  }

  async del(key: any, options?: EncodingOptions) {
    const batch = new WriteBatch()
    batch.del(new Slice(key))
    await this.write(batch, options)
  }

  async write(batch: WriteBatch | null, options?: EncodingOptions) {
    await this.ok()
    await this.makeRoomForWrite(!batch)
    // console.log('makeRoomForWrite end...')

    if (!!batch) {
      let lastSequence = this._versionSet.lastSequence

      // await this._log.addRecord(LogRecord.add(sliceKey, sliceValue))
      // await this._log.addRecord(LogRecord.del(sliceKey))
      WriteBatch.insert(batch, this._memtable)
      // console.log('insert to memtable success')
      WriteBatch.setSequence(batch, lastSequence + 1)
      lastSequence += batch.count
      // await this._log.addRecord(batch.contents())

      // console.log('memtable size is: ', this._memtable.size)
    }
  }

  /**
   * force: force compact
   */
  private async makeRoomForWrite(force: boolean) {
    let allowDelay = !force
    let status = new Status()
    while (true) {
      if (this._bgError) {
        status = this._bgError
        break
      } else if (
        allowDelay &&
        this._versionSet.getNumLevelFiles(0) >= Config.kL0SlowdownWritesTrigger
      ) {
        // We are getting close to hitting a hard limit on the number of
        // L0 files.  Rather than delaying a single write by several
        // seconds when we hit the hard limit, start delaying each
        // individual write by 1ms to reduce latency variance.  Also,
        // this delay hands over some CPU to the compaction thread in
        // case it is sharing the same core as the writer.
        await new Promise(resolve => setTimeout(resolve, 1000))
        allowDelay = false
      } else if (!force && this._memtable.size <= kMemTableDumpSize) {
        // ✌ There is room in current memtable
        break
      } else if (!!this._immtable) {
        // We have filled up the current memtable, but the previous
        // one is still being compacted, so we wait.
        // TODO wait
        console.log('Current memtable full; waiting...\n')
        // await this._backgroundWorkingPromise
      } else if (
        this._versionSet.getNumLevelFiles(0) >= Config.kL0StopWritesTrigger
      ) {
        // There are too many level-0 files.
        // TODO wait
        console.log('Too many L0 files; waiting...\n')
        // await this._backgroundWorkingPromise
      } else {
        // TODO break loop
        // console.log('force')
        assert(this._versionSet.logNumber === 0) // no logfile is compaction
        const newLogNumber = this._versionSet.getNextFileNumber()
        this._log = new LogWriter(getLogFilename(this._dbpath, newLogNumber))
        this._immtable = this._memtable
        this._memtable = new MemTable(this._internalKeyComparator)
        this._memtable.ref()
        this._logFileNumber = newLogNumber
        force = false
        this.maybeScheduleCompaction()
      }
    }
    return status
  }

  private async maybeScheduleCompaction() {
    if (this._backgroundCompactionScheduled) {
      // Already scheduled
    } else if (this._bgError && !(await this._bgError.ok())) {
      // Already got an error; no more changes
    } else if (
      !this._immtable &&
      !this._manualCompaction &&
      !this._versionSet.needsCompaction()
    ) {
      // No work to be done
    } else {
      this._backgroundCompactionScheduled = true
      this.backgroundCompaction()
    }
  }

  private schedule() {}

  private bgwork() {}

  private backgroundCall() {}

  // ignore: Schedule, BGWork and BackgroundCall
  private async backgroundCompaction(): Promise<void> {
    if (this._backgroundCompactionScheduled) return
    this._backgroundCompactionScheduled = true
    let c: Compaction | void
    let manualEnd = new InternalKey()
    if (!!this._manualCompaction) {
      let m = this._manualCompaction
      c = this._versionSet.compactRange(m.level, m.begin, m.end)
      m.done = !c
      if (!!c) {
        manualEnd = c.inputs[0][c.numInputFiles(0) - 1].largest
      }
      console.log(`Manual compaction ...`)
    } else {
      c = this._versionSet.pickCompaction()
    }

    let status = new Status()

    if (!c) {
    } else if (!this._manualCompaction && c.isTrivialMode()) {
      assert(c.numInputFiles(0) === 1)
      const f = c.inputs[0][0]
      c.edit.deletedFile(c.level, f.number)
      c.edit.addFile(c.level + 1, f.number, f.fileSize, f.smallest, f.largest)
      status = await this._versionSet.logAndApply(c.edit)
    } else {
      const compact = new CompactionState(c)
      const status = await this.doCompactionWork(compact)
      if (!(await status.ok())) {
        await this.recordBackgroundError(status)
      }
      this.cleanupCompaction(compact)
      c.releaseInputs()
      this.deleteObsoleteFiles()
    }

    if (await status.ok()) {
    } else {
      console.log(`Compaction error...`)
    }

    if (!!this._manualCompaction) {
      let m = this._manualCompaction
      if (!status.ok()) {
        m.done = true
      }
      if (!m.done) {
        // We only compacted part of the requested range.  Update *m
        // to the range that is left to be compacted.
        m.tmpStorage = manualEnd
        m.begin = m.tmpStorage
      }
      this._manualCompaction = null
    }
  }

  // TODO
  private async doCompactionWork(compact: CompactionState): Promise<Status> {
    const startTime: number = Number(process.hrtime.bigint()) / Math.pow(10, 9)
    let immTime = 0 // Time spent doing imm_ compactions
    console.log('Compacting files...')
    assert(this._versionSet.getNumLevelFiles(compact.compaction.level) > 0)
    assert(!compact.builder)
    assert(!compact.outfile)
    if (this.snapshots.length === 0) {
      compact.smallestSnapshot = this._versionSet.lastSequence
    } else {
      compact.smallestSnapshot = this.snapshots[this.snapshots.length - 1]
    }

    const status = new Status()

    for await (let input of this._versionSet.makeInputIterator(
      compact.compaction
    )) {
    }

    return status
  }

  private async compactMemTable() {}

  /**
   * manually compact
   */
  async compactRange(begin: Slice, end: Slice): Promise<void> {
    let maxLevelWithFiles = 1
    let base = this._versionSet._current
    for (let level = 0; level < Config.kNumLevels; level++) {
      if (base.overlapInLevel(level, begin, end)) {
        maxLevelWithFiles = level
      }
    }
    await this.manualCompactMemTable()
    // console.log('manualCompactMemTable end')
    for (let level = 0; level < maxLevelWithFiles; level++) {
      this.manualCompactRangeWithLevel(level, begin, end)
    }
    // console.log('compactRange end')
  }

  private manualCompactRangeWithLevel(
    level: number,
    begin: Slice,
    end: Slice
  ) {}

  private async manualCompactMemTable() {
    await this.write(null, {})
  }

  private async recordBackgroundError(status: Status) {
    console.log(await status.message())
  }

  // TODO
  private cleanupCompaction(compact: CompactionState) {}

  private async deleteObsoleteFiles() {
    const live = this.pendingOutputs || []
    this._versionSet.addLiveFiles(live)
    const filenames = (await fs.promises.readdir(this._dbpath, {
      withFileTypes: true,
    })).reduce((filenames: string[], direct) => {
      if (direct.isFile()) {
        filenames.push(direct.name)
      }
      return filenames
    }, [])
    let number = 0
    let type: FileType = -1
    let filesToDelete: string[] = []
    for (let filename of filenames) {
      if (parseFilename(filename, number, type)) {
        let keep = true
        switch (type) {
          case FileType.kLogFile:
            keep =
              number >= this._versionSet.logNumber ||
              number === this._versionSet.prevLogNumber
            break
          case FileType.kDescriptorFile:
            // Keep my manifest file, and any newer incarnations'
            // (in case there is a race that allows other incarnations)
            keep = number >= this._versionSet.manifestFileNumber
            break
          case FileType.kTableFile:
            keep = live.indexOf(number) !== live[live.length - 1]
            break
          case FileType.kTempFile:
            // Any temp files that are currently being written to must
            // be recorded in pending_outputs_, which is inserted into "live"
            keep = live.indexOf(number) !== live[live.length - 1]
            break
          case FileType.kCurrentFile:
          case FileType.kDBLockFile:
          case FileType.kInfoLogFile:
            keep = true
            break
        }
        if (!keep) {
          filesToDelete.push(filename)
          if (type == FileType.kTableFile) {
            // TODO this.tableCache.Evict(number)
          }
          console.log(`Delete type=${type} #${number}`)
        }
      }
    }

    for (let filename of filesToDelete) {
      await fs.promises.unlink(path.resolve(this._dbpath, filename))
    }
  }
}
