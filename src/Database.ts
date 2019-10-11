/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path'
import assert from 'assert'
import MemTable from './MemTable'
import LogWriter from './LogWriter'
import { EncodingOptions, Options, ReadOptions } from './Options'
import {
  ValueType,
  kMemTableDumpSize,
  Config,
  FileType,
  InternalKeyComparator,
  parseInternalKey,
  ParsedInternalKey,
  InternalKey,
  SequenceNumber,
  kValueTypeForSeek,
  LookupKey,
} from './Format'
import { FileMetaData, GetStats } from './VersionFormat'
import Version from './Version'
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
  getOldInfoLogFilename,
  getInfoLogFilename,
} from './Filename'
import WriteBatch from './WriteBatch'
import Status from './Status'
import SSTableBuilder from './SSTableBuilder'
import { BytewiseComparator } from './Comparator'
import { Direct, InfoLog, Log } from './Env'
import { TableCache } from './SSTableCache'
import { Snapshot, SnapshotList } from './Snapshot'

// Information for a manual compaction
interface ManualCompaction {
  level: number
  done: boolean
  begin: InternalKey // null means beginning of key range
  end: InternalKey // null means end of key range
  tmpStorage: InternalKey // Used to keep track of compaction progress
}

const kNumNonTableCacheFiles = 10

function getTableCacheSize(sanitizedOptions: Options) {
  // Reserve ten files or so for other uses and give the rest to TableCache.
  return sanitizedOptions.maxOpenFiles - kNumNonTableCacheFiles
}

export default class Database {
  constructor(dbpath: string) {
    this._backgroundCompactionScheduled = false
    this._internalKeyComparator = new InternalKeyComparator(
      new BytewiseComparator()
    )
    this._ok = false
    this._dbpath = dbpath
    this._memtable = new MemTable(this._internalKeyComparator)
    this._sn = new SequenceNumber(0)
    this.pendingOutputs = []
    this._stats = Array.from(
      { length: Config.kNumLevels },
      () => new CompactionStats()
    )

    const options = new Options()
    options.comparator = this._internalKeyComparator
    this._options = options

    this._log = new LogWriter(this._options, getLogFilename(dbpath, 1))
    this._tableCache = new TableCache(
      dbpath,
      options,
      getTableCacheSize(options)
    )

    this._versionSet = new VersionSet(
      this._dbpath,
      options,
      this._tableCache,
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
  private snapshots!: SnapshotList
  private _stats: CompactionStats[]
  private _options: Options
  private _tableCache: TableCache

  private get userComparator() {
    return this._internalKeyComparator.userComparator
  }

  private async existCurrent(): Promise<boolean> {
    try {
      const currentName = getCurrentFilename(this._dbpath)
      try {
        await this._options.env.access(this._dbpath)
      } catch (e) {
        await this._options.env.mkdir(this._dbpath)
        return false
      }
      await this._options.env.access(currentName)
      return true
    } catch (e) {
      return false
    }
  }

  private async initVersionEdit(): Promise<void> {
    const edit = new VersionEdit()
    edit.comparator = this._internalKeyComparator.getName()
    edit.logNumber = 0
    edit.nextFileNumber = 2
    edit.lastSequence = 0
    const writer = new LogWriter(
      this._options,
      getManifestFilename(this._dbpath, 1)
    )
    await writer.addRecord(VersionEditRecord.add(edit))
    await writer.close()
    await this._options.env.writeFile(
      getCurrentFilename(this._dbpath),
      'MANIFEST-000001\n'
    )
  }

  private async recover(): Promise<void> {
    if (!(await this.existCurrent())) {
      try {
        await this._options.env.rename(
          getInfoLogFilename(this._dbpath),
          getOldInfoLogFilename(this._dbpath)
        )
      } catch (e) {}
      await this.initVersionEdit()
    }

    this._options.infoLog = new InfoLog(
      await this._options.env.openInfoLog(this._dbpath)
    )
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
   * TODO Trigger major compaction's condition:
   * 1. manually compact
   * 2. filter seek miss > allowed_seeks
   * 3. level0 sstable > 8
   * 4. leveli(i>0) sstable bytes > 10^iMB
   *
   * db.get -> memtable.get -> imm.get -> versionCurrent.get ->
   * versionCurrent.forEachOverlapping -> tableCache.get -> tableCache.findTable ->
   * table.get
   */
  public async get(
    options: ReadOptions,
    userKey: Slice
  ): Promise<Slice | string | null | void> {
    await this.ok()
    const slicedUserKey = new Slice(userKey)
    const sequence = options.snapshot
      ? new Snapshot(options.snapshot).sequenceNumber
      : new SequenceNumber(this._versionSet.lastSequence)
    const lookupKey = new LookupKey(slicedUserKey, sequence)

    const current = this._versionSet.current
    this._memtable.ref()
    if (!!this._immtable) this._immtable.ref()
    current.ref()

    let result = this._memtable.get(lookupKey)
    if (!result && !!this._immtable) {
      result = this._immtable.get(lookupKey)
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
   * TODO Trigger minor compaction's condition
   * 1. check if memtable bigger then 4mb
   * 2. check if this._immtable is not null（transfer memtable to sstable）
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

    if (!!batch) {
      let lastSequence = this._versionSet.lastSequence
      WriteBatch.setSequence(batch, lastSequence + 1)
      lastSequence += WriteBatch.getCount(batch)
      // TODO add to log
      await this._log.addRecord(new Slice(WriteBatch.getContents(batch)))

      WriteBatch.insert(batch, this._memtable)
      this._versionSet.lastSequence = lastSequence
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
        Log(this._options.infoLog, 'Current memtable full; waiting...\n')
        // await this._backgroundWorkingPromise
      } else if (
        this._versionSet.getNumLevelFiles(0) >= Config.kL0StopWritesTrigger
      ) {
        // There are too many level-0 files.
        // TODO wait
        Log(this._options.infoLog, 'Too many L0 files; waiting...\n')
        // await this._backgroundWorkingPromise
      } else {
        // Attempt to switch to a new memtable and trigger compaction of old
        assert(this._versionSet.logNumber === 0) // no logfile is compaction
        const newLogNumber = this._versionSet.getNextFileNumber()
        this._log = new LogWriter(
          this._options,
          getLogFilename(this._dbpath, newLogNumber)
        )
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

    let compaction: Compaction | void
    let manualEnd = new InternalKey()

    if (!!this._manualCompaction) {
      let m = this._manualCompaction
      compaction = this._versionSet.compactRange(m.level, m.begin, m.end)
      m.done = !compaction
      if (!!compaction) {
        manualEnd =
          compaction.inputs[0][compaction.numInputFiles(0) - 1].largest
      }
      // Manual compaction ...
    } else {
      compaction = this._versionSet.pickCompaction()
    }

    let status = new Status()

    if (!compaction) {
    } else if (!this._manualCompaction && compaction.isTrivialMove()) {
      assert(compaction.numInputFiles(0) === 1)
      const f = compaction.inputs[0][0]
      compaction.edit.deleteFile(compaction.level, f.number)
      compaction.edit.addFile(
        compaction.level + 1,
        f.number,
        f.fileSize,
        f.smallest,
        f.largest
      )
      status = await this._versionSet.logAndApply(compaction.edit)
    } else {
      const compact = new CompactionState(compaction)
      const status = await this.doCompactionWork(compact)
      if (!(await status.ok())) {
        await this.recordBackgroundError(status)
      }
      await this.cleanupCompaction(compact)
      compaction.releaseInputs()
      await this.deleteObsoleteFiles()
    }

    if (await status.ok()) {
    } else {
      Log(this._options.infoLog, `Compaction error...`)
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
    console.log('doCompactionWork')
    const startTime: number = this._options.env.now()
    let immTime = 0 // Time spent doing imm_ compactions
    Log(this._options.infoLog, 'Compacting files...')
    assert(this._versionSet.getNumLevelFiles(compact.compaction.level) > 0)
    assert(!compact.builder)
    assert(!compact.outfile)
    if (!this.snapshots) {
      compact.smallestSnapshot = this._versionSet.lastSequence
    } else {
      compact.smallestSnapshot = this.snapshots.oldest().sequenceNumber.value
    }

    let status = new Status()
    let ikey = new ParsedInternalKey()
    let currentUserKey = new Slice()
    let hasCurrentUserKey: boolean = false
    let lastSequenceForKey = InternalKey.kMaxSequenceNumber
    Log(this._options.infoLog, `doCompactionWork before make input iterator`)
    for await (let input of this._versionSet.makeInputIterator(
      compact.compaction
    )) {
      // Prioritize immutable compaction work
      if (!!this._immtable) {
        const immStartTime = this._options.env.now()
        await this.compactMemTable()
        immTime += this._options.env.now() - immStartTime
      }

      const key = input.key

      if (compact.compaction.shouldStopBefore(key) && !!compact.builder) {
        status = await this.finishCompactionOutputFile(compact, status)
        if (!(await status.ok())) {
          break
        }
      }
      let drop = false
      if (!parseInternalKey(key, ikey)) {
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
    stats.times = this._options.env.now() - startTime - immTime

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
    Log(
      this._options.infoLog,
      `compacted to: ${this._versionSet.getLevelSummary()}`
    )

    return status
  }

  private async compactMemTable() {
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
    const startTime = this._options.env.now()
    const meta = new FileMetaData()
    meta.fileSize = 0
    meta.number = this._versionSet.getNextFileNumber()
    meta.largest = new InternalKey()
    this.pendingOutputs.push(meta.number)
    Log(this._options.infoLog, `Level-0 table #${meta.number}: started`)
    const fileHandler = getTableFilename(this._dbpath, meta.number)
    let status = new Status(this._options.env.open(fileHandler, 'a+'))
    if (!(await status.ok())) {
      return status
    }
    const builder = new SSTableBuilder(await status.promise, this._options)
    for (let entry of mem.iterator()) {
      if (!meta.smallest) {
        meta.smallest = new InternalKey()
        meta.smallest.decodeFrom(entry.key)
      }
      meta.largest.decodeFrom(entry.key)
      await builder.add(entry.key, entry.value)
    }

    status = new Status(builder.finish())
    if (!(await status.ok())) {
      return status
    }
    meta.fileSize = builder.fileSize

    Log(
      this._options.infoLog,
      `Level-0 table #${meta.number}: ${
        meta.fileSize
      } bytes ${await status.ok()}`
    )
    this.pendingOutputs = this.pendingOutputs.filter(num => num !== meta.number)

    // Note that if file_size is zero, the file has been deleted and
    // should not be added to the manifest.
    let level = 0
    if ((await status.ok()) && meta.fileSize > 0) {
      const minUserKey = meta.smallest.userKey
      const maxUserKey = meta.largest.userKey
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
    stats.times = this._options.env.now() - startTime
    stats.bytesWritten = meta.fileSize
    this._stats[level].add(stats)
    return status
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
    const s = new Status(this._options.env.open(fname, 'a+'))
    if (await s.ok()) {
      compact.builder = new SSTableBuilder(await s.promise, this._options)
    }
    return s
  }

  private async installCompactionResults(
    compact: CompactionState
  ): Promise<Status> {
    Log(
      this._options.infoLog,
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
    await status.ok()
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
    const filenames = (await this._options.env.readdir(this._dbpath)).reduce(
      (filenames: string[], direct: Direct) => {
        if (direct.isFile()) {
          filenames.push(direct.name)
        }
        return filenames
      },
      []
    )
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
          Log(this._options.infoLog, `Delete type=${type} #${number}`)
        }
      }
    }

    for (let filename of filesToDelete) {
      await this._options.env.unlink(path.resolve(this._dbpath, filename))
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
        this._options.env.access(getTableFilename(this._dbpath, outputNumber))
      )
      if (await status.ok()) {
        Log(
          this._options.infoLog,
          `Generated table #${outputNumber}@${compact.compaction.level}: ${currentEntries} keys, ${currentBytes} bytes`
        )
      }
    }

    return status
  }
}
