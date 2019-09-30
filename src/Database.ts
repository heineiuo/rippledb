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
  ParsedInternalKey,
  FileMetaData,
  Entry,
  kValueTypeForSeek,
  GetStats,
} from './VersionFormat'
import Version from './Version'
import SequenceNumber from './SequenceNumber'
import Compaction, {
  CompactionState,
  CompactionStateOutput,
  CompactionStats,
} from './Compaction'
import Slice from './Slice'
import VersionSet from './VersionSet'
import VersionEdit from './VersionEdit'
import VersionEditRecord from './VersionEditRecord'
import {
  parseFilename,
  getCurrentFilename,
  getLogFilename,
  getManifestFilename,
  getTableFilename,
} from './Filename'
import WriteBatch from './WriteBatch'
import Status from './Status'
import Env from './Env'
import SSTableBuilder from './SSTableBuilder'

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
  private _immtable!: MemTable
  private _versionSet: VersionSet
  private _ok: boolean
  private _manualCompaction!: ManualCompaction | null
  private _bgError!: Status
  private pendingOutputs!: number[]
  private snapshots!: number[]
  private _stats: CompactionStats[]

  constructor(dbpath: string) {
    this._backgroundCompactionScheduled = false
    this._internalKeyComparator = new InternalKeyComparator()
    this._ok = false
    this._dbpath = dbpath
    this._log = new LogWriter(getLogFilename(dbpath, 1))
    this._memtable = new MemTable(this._internalKeyComparator)
    this._sn = new SequenceNumber(0)
    this.pendingOutputs = []
    this._stats = Array.from(
      { length: Config.kNumLevels },
      () => new CompactionStats()
    )

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

  private get userComparator() {
    return this._internalKeyComparator.userComparator
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

  public async *iterator(options?: EncodingOptions) {
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
  public async get(key: any, options?: EncodingOptions): Promise<any> {
    await this.ok()
    // console.log('get ok')
    const sliceKey = new Slice(key)
    // console.log('sliceKey', sliceKey)
    const lookupKey = MemTable.createLookupKey(
      this._sn,
      sliceKey,
      ValueType.kTypeValue
    )

    const current = this._versionSet.current
    this._memtable.ref()
    if (!!this._immtable) this._immtable.ref()
    current.ref()

    let result = this._memtable.get(lookupKey, options)
    if (!result && !!this._immtable) {
      result = this._immtable.get(lookupKey, options)
    }
    if (!result) {
      const s = await current.get(lookupKey, {} as GetStats)
      if (await s.ok()) {
        result = await s.promise
      }
    }
    return result
  }

  /**
   * TODO 触发minor compaction
   * 1. 检查memtable是否超过4mb
   * 2. 检查this._immtable是否为null（memtable转sstable）
   */
  public async put(key: any, value: any, options?: EncodingOptions) {
    const batch = new WriteBatch()
    batch.put(new Slice(key), new Slice(value))
    await this.write(batch, options)
  }

  public async del(key: any, options?: EncodingOptions) {
    const batch = new WriteBatch()
    batch.del(new Slice(key))
    await this.write(batch, options)
  }

  public async write(batch: WriteBatch | null, options?: EncodingOptions) {
    await this.ok()
    await this.makeRoomForWrite(!batch)
    // console.log('makeRoomForWrite end...')

    if (!!batch) {
      let lastSequence = this._versionSet.lastSequence
      // console.log(`VersionSet last sequence is ${lastSequence}`)

      // await this._log.addRecord(LogRecord.add(sliceKey, sliceValue))
      // await this._log.addRecord(LogRecord.del(sliceKey))
      WriteBatch.insert(batch, this._memtable)
      // console.log('insert to memtable success')
      WriteBatch.setSequence(batch, lastSequence + 1)
      lastSequence += WriteBatch.getCount(batch)
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
        // There is room in current memtable
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
        // Attempt to switch to a new memtable and trigger compaction of old
        assert(this._versionSet.logNumber === 0) // no logfile is compaction
        const newLogNumber = this._versionSet.getNextFileNumber()
        this._log = new LogWriter(getLogFilename(this._dbpath, newLogNumber))
        this._immtable = this._memtable
        this._memtable = new MemTable(this._internalKeyComparator)
        this._memtable.ref()
        this._logFileNumber = newLogNumber
        force = false
        await this.maybeScheduleCompaction()
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
      // console.log(
      //   `this._backgroundCompactionScheduled=${this._backgroundCompactionScheduled} so passed`
      // )
      // console.log(
      //   `this._bgError && !(await this._bgError.ok())=${this._bgError &&
      //     !(await this._bgError.ok())} so passed`
      // )
      // console.log(
      //   `!this._immtable=${!this._immtable} !this._manualCompaction=${!this
      //     ._manualCompaction} !this._versionSet.needsCompaction()=${!this._versionSet.needsCompaction()} so passed`
      // )
      this._backgroundCompactionScheduled = true
      // ignore: Env.Schedule, BGWork
      await this.backgroundCall()
    }
  }

  private async backgroundCall() {
    assert(this._backgroundCompactionScheduled)
    await this.backgroundCompaction()
    this._backgroundCompactionScheduled = false

    // Previous compaction may have produced too many files in a level,
    // so reschedule another compaction if needed.
    await this.maybeScheduleCompaction()
  }

  private async backgroundCompaction(): Promise<void> {
    if (!!this._immtable) {
      await this.compactMemTable()
      return
    }

    let c: Compaction | void
    let manualEnd = new InternalKey()

    if (!!this._manualCompaction) {
      let m = this._manualCompaction
      c = this._versionSet.compactRange(m.level, m.begin, m.end)
      m.done = !c
      if (!!c) {
        manualEnd = c.inputs[0][c.numInputFiles(0) - 1].largest
      }
      // Manual compaction ...
    } else {
      c = this._versionSet.pickCompaction()
    }

    let status = new Status()

    if (!c) {
      // console.log('Nothing to do')
    } else if (!this._manualCompaction && c.isTrivialMode()) {
      // console.log('Move file to next level')
      assert(c.numInputFiles(0) === 1)
      const f = c.inputs[0][0]
      c.edit.deleteFile(c.level, f.number)
      c.edit.addFile(c.level + 1, f.number, f.fileSize, f.smallest, f.largest)
      status = await this._versionSet.logAndApply(c.edit)
    } else {
      const compact = new CompactionState(c)
      const status = await this.doCompactionWork(compact)
      if (!(await status.ok())) {
        await this.recordBackgroundError(status)
      }
      await this.cleanupCompaction(compact)
      c.releaseInputs()
      await this.deleteObsoleteFiles()
    }

    if (await status.ok()) {
      // console.log('Done')
    } else {
      console.log(`Compaction error...`)
    }

    if (!!this._manualCompaction) {
      let m = this._manualCompaction
      if (!(await status.ok())) {
        m.done = true
      }

      if (!m.done) {
        // We only compacted part of the requested range.  Update *m
        // to the range that is left to be compacted.
        m.tmpStorage = manualEnd
        m.begin = m.tmpStorage
      }
      delete this._manualCompaction
    }
  }

  private async doCompactionWork(compact: CompactionState): Promise<Status> {
    const startTime: number = Env.now()
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

    let status = new Status()
    let ikey = new ParsedInternalKey()
    let currentUserKey = new Slice()
    let hasCurrentUserKey: boolean = false
    let lastSequenceForKey = InternalKey.kMaxSequenceNumber
    for await (let input of this._versionSet.makeInputIterator(
      compact.compaction
    )) {
      // Prioritize immutable compaction work
      if (!!this._immtable) {
        const immStartTime = Env.now()
        await this.compactMemTable()
        immTime += Env.now() - immStartTime
      }

      const key = input.key
      if (compact.compaction.shouldStopBefore(key) && !!compact.builder) {
        status = await this.finishCompactionOutputFile(compact, status)
        if (!(await status.ok())) {
          break
        }
      }
      let drop = false
      if (!InternalKey.parseInternalKey(key, ikey)) {
        currentUserKey.clear()
        hasCurrentUserKey = false
        lastSequenceForKey = InternalKey.kMaxSequenceNumber
      } else {
        if (
          !hasCurrentUserKey ||
          this.userComparator.compare(ikey.userKey, currentUserKey) !== 0
        ) {
          // First occurrence of this user key
          currentUserKey.buffer = ikey.userKey.buffer
          hasCurrentUserKey = true
          lastSequenceForKey = InternalKey.kMaxSequenceNumber
        }
        if (lastSequenceForKey.value <= compact.smallestSnapshot) {
          // Hidden by an newer entry for same user key
          drop = true // (A)
        } else if (
          ikey.valueType === ValueType.kTypeDeletion &&
          ikey.sn.value <= compact.smallestSnapshot &&
          compact.compaction.isBaseLevelForKey(ikey.userKey)
        ) {
          // For this user key:
          // (1) there is no data in higher levels
          // (2) data in lower levels will have larger sequence numbers
          // (3) data in layers that are being compacted here and have
          //     smaller sequence numbers will be dropped in the next
          //     few iterations of this loop (by rule (A) above).
          // Therefore this deletion marker is obsolete and can be dropped.
          drop = true
        }
        lastSequenceForKey = ikey.sn
      }

      if (!drop) {
        // Open output file if necessary
        if (!compact.builder) {
          status = await this.openCompactionOutputFile(compact)
          if (!(await status.ok())) {
            break
          }
        }
        if (compact.builder.numEntries == 0) {
          compact.currentOutput().smallest.decodeFrom(key)
        }
        compact.currentOutput().largest.decodeFrom(key)
        compact.builder.add(key, input.value)

        // Close output file if it is big enough
        if (compact.builder.fileSize >= compact.compaction.maxOutputFilesize) {
          status = await this.finishCompactionOutputFile(compact, new Status())
          if (!(await status.ok())) {
            break
          }
        }
      }
    }

    if ((await status.ok()) && !!compact.builder) {
      status = await this.finishCompactionOutputFile(compact, status)
    }

    const stats = new CompactionStats()
    stats.times = Env.now() - startTime - immTime

    for (let which = 0 as 0 | 1; which < 2; which++) {
      for (let i = 0; i < compact.compaction.numInputFiles(which); i++) {
        stats.bytesRead += compact.compaction.inputs[which][i].fileSize
      }
    }
    for (let i = 0; i < compact.outputs.length; i++) {
      stats.bytesWritten += compact.outputs[i].fileSize
    }
    this._stats[compact.compaction.level + 1].add(stats)

    if (await status.ok()) {
      status = await this.installCompactionResults(compact)
    }

    // TODO log level summary

    return status
  }

  private async compactMemTable() {
    // console.log(`compactMemTable start`)
    assert(!!this._immtable)

    // Save the contents of the memtable as a new Table
    const edit = new VersionEdit()
    const base = this._versionSet.current
    base.ref()
    let s: Status = await this.writeLevel0Table(this._immtable, edit, base)
    base.unref()

    // Replace immutable memtable with the generated Table
    if (await s.ok()) {
      edit.prevLogNumber = 0
      edit.logNumber = this._logFileNumber // Earlier logs no longer needed
      s = await this._versionSet.logAndApply(edit)
    }

    if (await s.ok()) {
      // Commit to the new state
      assert(!!this._immtable)
      this._immtable.unref()
      delete this._immtable
      await this.deleteObsoleteFiles()
    } else {
      this.recordBackgroundError(s)
    }
  }

  private async writeLevel0Table(
    mem: MemTable,
    edit: VersionEdit,
    base: Version
  ): Promise<Status> {
    const startTime = Env.now()
    const meta = new FileMetaData()
    meta.fileSize = 0
    meta.number = this._versionSet.getNextFileNumber()
    this.pendingOutputs.push(meta.number)
    console.log(`Level-0 table #${meta.number}: started`)
    const fileHandler = getTableFilename(this._dbpath, meta.number)
    let s = new Status(fs.promises.open(fileHandler, 'a+'))
    if (!(await s.ok())) {
      console.log(await s.message())
      return s
    }
    const tableBuilder = new SSTableBuilder(await s.promise)
    for (let entry of mem.iterator()) {
      if (!meta.smallest)
        meta.smallest = new InternalKey(entry.key, entry.sequence, entry.type)
      meta.largest = new InternalKey(entry.key, entry.sequence, entry.type)
      await tableBuilder.add(entry.key, entry.value)
    }

    s = new Status(tableBuilder.close())
    if (!(await s.ok())) {
      console.log(await s.message())
      return s
    }
    meta.fileSize = tableBuilder.fileSize

    console.log(
      `Level-0 table #${meta.number}: ${meta.fileSize} bytes ${await s.ok()}`
    )
    this.pendingOutputs = this.pendingOutputs.filter(num => num !== meta.number)

    // Note that if file_size is zero, the file has been deleted and
    // should not be added to the manifest.
    let level = 0
    if ((await s.ok()) && meta.fileSize > 0) {
      const minUserKey = meta.smallest.extractUserKey()
      const maxUserKey = meta.largest.extractUserKey()
      if (!!base) {
        level = base.pickLevelForMemTableOutput(minUserKey, maxUserKey)
      }
      edit.addFile(
        level,
        meta.number,
        meta.fileSize,
        meta.smallest,
        meta.largest
      )
    }

    const stats = new CompactionStats()
    stats.times = Env.now() - startTime
    stats.bytesWritten = meta.fileSize
    this._stats[level].add(stats)
    return s
  }

  private async openCompactionOutputFile(
    compact: CompactionState
  ): Promise<Status> {
    assert(!!compact)
    assert(!compact.builder)
    let fileNumber = this._versionSet.getNextFileNumber()
    this.pendingOutputs.push(fileNumber)
    const out = {} as CompactionStateOutput
    out.number = fileNumber
    out.smallest = new InternalKey()
    out.largest = new InternalKey()
    compact.outputs.push(out)
    const fname = getTableFilename(this._dbpath, fileNumber)
    const s = new Status(fs.promises.open(fname, 'a+'))
    if (await s.ok()) {
      compact.builder = new SSTableBuilder(await s.promise)
    }
    return s
  }

  private async installCompactionResults(
    compact: CompactionState
  ): Promise<Status> {
    console.log(
      `Compacted ${compact.compaction.numInputFiles(0)}@${
        compact.compaction.level
      } + ${compact.compaction.numInputFiles(1)}@${compact.compaction.level +
        1} files => ${compact.totalBytes} bytes"`
    )
    // Add compaction outputs
    compact.compaction.addInputDeletions(compact.compaction.edit)
    const level = compact.compaction.level
    for (let i = 0; i < compact.outputs.length; i++) {
      const out = compact.outputs[i]
      compact.compaction.edit.addFile(
        level + 1,
        out.number,
        out.fileSize,
        out.smallest,
        out.largest
      )
    }
    const status = new Status(
      this._versionSet.logAndApply(compact.compaction.edit)
    )
    await status.promise
    return status
  }

  /**
   * manually compact
   */
  public async compactRange(begin: Slice, end: Slice): Promise<void> {
    let maxLevelWithFiles = 1
    let base = this._versionSet._current
    for (let level = 0; level < Config.kNumLevels; level++) {
      if (base.overlapInLevel(level, begin, end)) {
        maxLevelWithFiles = level
      }
    }

    await this.manualCompactMemTable()
    for (let level = 0; level < maxLevelWithFiles; level++) {
      await this.manualCompactRangeWithLevel(level, begin, end)
    }
  }

  private async manualCompactRangeWithLevel(
    level: number,
    begin: Slice,
    end: Slice
  ) {
    // console.log(
    //   `manualCompactRangeWithLevel level:${level} begin:${begin.toString()} end:${end.toString()}`
    // )
    assert(level >= 0)
    assert(level + 1 < Config.kNumLevels)
    let beginStorage = new InternalKey()
    let endStorage = new InternalKey()
    let manual = {} as ManualCompaction

    manual.level = level
    manual.done = false
    if (!begin) {
      delete manual.begin
    } else {
      beginStorage = new InternalKey(
        begin,
        InternalKey.kMaxSequenceNumber,
        kValueTypeForSeek
      )
      manual.begin = beginStorage
    }
    if (!end) {
      delete manual.end
    } else {
      endStorage = new InternalKey(
        end,
        new SequenceNumber(0),
        ValueType.kTypeValue
      )
      manual.end = endStorage
    }

    while (!manual.done) {
      if (!this._manualCompaction) {
        // Idle
        this._manualCompaction = manual
        await this.maybeScheduleCompaction()
      } else {
        // Running either my compaction or another compaction.
        // TODO background_work_finished_signal_.Wait();
      }
    }
    if (this._manualCompaction === manual) {
      // Cancel my manual compaction since we aborted early for some reason.
      delete this._manualCompaction
    }
  }

  private async manualCompactMemTable() {
    await this.write(null, {})
  }

  private async recordBackgroundError(status: Status) {
    console.log(await status.message())
  }

  private async cleanupCompaction(compact: CompactionState) {
    if (!!compact.builder) {
      await compact.builder.abandon()
      delete compact.builder
    } else {
      assert(!compact.outfile)
    }
    delete compact.outfile
    for (let i = 0; i < compact.outputs.length; i++) {
      const out = compact.outputs[i]
      this.pendingOutputs = this.pendingOutputs.filter(
        num => num !== out.number
      )
    }
  }

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

  private async finishCompactionOutputFile(
    compact: CompactionState,
    inputStatus: Status
  ): Promise<Status> {
    let status = new Status()
    assert(!!compact)
    assert(!!compact.outfile)
    assert(!!compact.builder)
    const outputNumber = compact.currentOutput().number
    assert(outputNumber !== 0)
    const currentEntries = compact.builder.numEntries
    if (await inputStatus.ok()) {
      status = new Status(compact.builder.finish())
      await status.ok()
    } else {
      await compact.builder.abandon()
    }

    const currentBytes = compact.builder.fileSize
    compact.currentOutput().fileSize = currentBytes
    compact.totalBytes += currentBytes
    delete compact.builder

    // TODO sync and close outfile

    delete compact.outfile

    if (currentEntries > 0) {
      status = new Status(
        fs.promises.access(getTableFilename(this._dbpath, outputNumber))
      )
      if (await status.ok()) {
        console.log(
          `Generated table #${outputNumber}@${compact.compaction.level}: ${currentEntries} keys, ${currentBytes} bytes`
        )
      }
    }

    return status
  }
}
