/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import fs from 'fs'
import Version from './Version'
import { getCurrentFilename, getManifestFilename } from './Filename'
import Slice from './Slice'
import {
  CompactPointer,
  InternalKeyComparator,
  getExpandedCompactionByteSizeLimit,
  getMaxBytesForLevel,
  InternalKey,
} from './VersionFormat'
import { FileMetaData } from './VersionFormat'
import VersionBuilder from './VersionBuilder'
import VersionEditRecord from './VersionEditRecord'
import LogReader from './LogReader'
import MemTable from './MemTable'
import VersionEdit from './VersionEdit'
import { Config } from './Format'
import LogWriter from './LogWriter'
import Compaction from './Compaction'

export default class VersionSet {
  // Per-level key at which the next compaction at that level should start.
  // Either an empty string, or a valid InternalKey.
  compactPointers: string[]
  _manifestFileNumber?: number
  _current!: Version
  _dummyVersions: Version
  hasLogNumber?: boolean
  hasNextFileNumber?: boolean
  hasPrevLogNumber?: boolean
  logNumber!: number

  // if prevLogNumber is 0, then no log file is being compacted
  prevLogNumber!: number
  lastSequence!: number
  hasLastSequence?: boolean
  manifestFileNumber!: number
  nextFileNumber!: number

  _dbpath: string
  _options: any
  _memtable: MemTable
  internalKeyComparator: InternalKeyComparator

  manifestWritter?: LogWriter

  constructor(
    dbpath: string,
    options: any,
    memtable: MemTable,
    internalKeyComparator: InternalKeyComparator
  ) {
    this._dbpath = dbpath
    this._options = options
    this._memtable = memtable
    this.internalKeyComparator = internalKeyComparator
    this._dummyVersions = new Version(this)
    this.appendVersion(new Version(this))
    this.compactPointers = []
  }

  get current(): Version {
    return this._current
  }

  getNextFileNumber(): number {
    return this.nextFileNumber++
  }

  getNumLevelFiles(level: number): number {
    assert(level >= 0)
    assert(level <= Config.kNumLevels)
    return this._current.files[level].length
  }

  async recover() {
    // 读取current， 校验是否是\n结尾
    const current = await fs.promises.readFile(
      getCurrentFilename(this._dbpath),
      'utf8'
    )
    if (!current || current[current.length - 1] !== '\n') {
      throw new Error('Invalid format of CURRENT file.')
    }

    let hasLogNumber = false
    let hasNextFileNumber = false
    let hasPrevLogNumber = false
    let hasLastSequence = false
    let logNumber = 0
    let nextFileNumber = 0
    let prevLogNumber = 0
    let lastSequence = 0

    const builder = new VersionBuilder(this, this._current)
    const currentValue = current.substr(0, current.length - 1)
    const manifestNumber = Number(currentValue.substr('MANIFEST-'.length))

    // 根据current读取dscfile(description file), 即manifest文件
    const reader = new LogReader(
      getManifestFilename(this._dbpath, manifestNumber)
      // VersionEditRecord
    )
    // 读取record，apply到versionSet(apply方法)
    // 更新log number和prev log number（可省略，因为prevlognumber其实被废弃了）
    // 更新next file
    // 更新last sequence
    // 通过version builder 创建一个新的version
    for await (let slice of reader.iterator()) {
      const edit = VersionEditRecord.decode(slice)
      // console.log(edit)
      builder.apply(edit)

      // 更新manifest_file_number_， next_file_number_， last_sequence_， log_number_， prev_log_number_
      if (edit.hasLogNumber) {
        logNumber = edit.logNumber
        hasLogNumber = true
      }

      if (edit.hasPrevLogNumber) {
        prevLogNumber = edit.prevLogNumber
        hasPrevLogNumber = true
      }

      if (edit.hasNextFileNumber) {
        nextFileNumber = edit.nextFileNumber
        hasNextFileNumber = true
      }

      if (edit.hasLastSequence) {
        lastSequence = edit.lastSequence
        hasLastSequence = true
      }
    }

    if (!hasNextFileNumber) {
      throw new Error('no meta-nextfile entry in descriptor')
    } else if (!hasLogNumber) {
      throw new Error('no meta-lognumber entry in descriptor')
    } else if (!hasLastSequence) {
      throw new Error('no last-sequence-number entry in descriptor')
    }

    if (!hasPrevLogNumber) {
      prevLogNumber = 0
    }

    this.markFileNumberUsed(prevLogNumber)
    this.markFileNumberUsed(logNumber)

    // 将apply的结果添加到version(finalize)
    const version = new Version(this)
    builder.saveTo(version)
    this.finalize(version)

    // 将version添加到version set(append version)
    this.appendVersion(version)
    this.manifestFileNumber = nextFileNumber
    this.nextFileNumber = nextFileNumber + 1
    this.lastSequence = lastSequence
    this.logNumber = logNumber
    this.prevLogNumber = prevLogNumber

    // 检查是否需要创建新的manifest（ reuseManifest ）
  }

  markFileNumberUsed(num: number) {
    if (this.nextFileNumber <= num) {
      this.nextFileNumber = num + 1
    }
  }

  // Precomputed best level for next compaction
  finalize(ver: Version) {
    // traverse levels(0-6),
    // 计算score，0级用文件数量 / 8（设置到最大允许值）， 其他用文件体积 / 最大允许体积10^level
    // 如果score > best_score（best_score初始值-1）, 更新best_score和best_level
    // traverse结束更新version的best_score和best_level
    let bestLevel = -1
    let bestScore = -1
    for (let level = 0; level < Config.kNumLevels; level++) {
      let score = 0
      if (level === 0) {
        score = ver.files[level].length / Config.kL0CompactionTrigger
      } else {
        const levelBytes = this.getTotalBytes(ver.files[level])
        score = levelBytes / getMaxBytesForLevel(level)
      }

      if (score > bestScore) {
        bestScore = score
        bestLevel = level
      }
    }

    ver.compactionLevel = bestLevel
    ver.compactionScore = bestScore
  }

  getTotalBytes(files: FileMetaData[]) {
    let sum = 0
    for (let f of files) {
      sum += f.fileSize
    }
    return sum
  }

  // 需要写入manifest
  logAndApply(edit: VersionEdit) {
    if (edit.hasLogNumber) {
      assert(edit.logNumber >= this.logNumber)
      assert(edit.logNumber < this.nextFileNumber)
    } else {
      edit.logNumber = this.logNumber
    }

    if (!edit.hasPrevLogNumber) {
      edit.prevLogNumber = this.prevLogNumber
    }

    edit.nextFileNumber = this.nextFileNumber
    edit.lastSequence = this.lastSequence

    const v = new Version(this)
    const builder = new VersionBuilder(this, this._current)
    builder.apply(edit)
    builder.saveTo(v)
    this.finalize(v)

    let manifestFilename: string
    if (this.manifestWritter) {
      const nextManifestFilename = getManifestFilename(
        this._dbpath,
        this.manifestFileNumber
      )
      edit.nextFileNumber = this.nextFileNumber
      const writter = new LogWriter(nextManifestFilename)
      this.writeSnapshot(writter)
    }
  }

  needsCompaction(): boolean {
    return (
      this._current.compactionScore >= 1 || this._current.fileToCompact !== null
    )
  }

  /**
   * 主要目的是更新this._current
   */
  appendVersion(ver: Version): void {
    assert(ver.refs === 0)
    assert(ver !== this._current)
    if (this._current) {
      this._current.unref()
    }
    this._current = ver
    ver.ref()
    ver.prev = this._dummyVersions.prev
    ver.next = this._dummyVersions
    ver.prev.next = ver
    ver.next.prev = ver
  }

  reuseManifest() {
    return false
  }

  /**
   * 将current写入manifest
   */
  writeSnapshot(writter: LogWriter) {
    const edit = new VersionEdit()
    edit.comparator = this.internalKeyComparator.userComparator.getName()

    const record = VersionEditRecord.add(edit)
    writter.addRecord(record)
  }

  pickCompaction(): Compaction | void {
    // We prefer compactions triggered by too much data in a level over
    // the compactions triggered by seeks.
    const shouldSizeCompaction = this._current.compactionScore > 1
    const shouldSeekCompaction = !!this._current.fileToCompact
    let c: Compaction
    let level: number
    if (shouldSizeCompaction) {
      level = this._current.compactionLevel
      assert(level >= 0)
      assert(level + 1 < Config.kNumLevels)
      c = new Compaction({}, level)

      for (let f of this._current.files[level]) {
        if (
          !this.compactPointers[level].length ||
          this.internalKeyComparator.compare(
            f.largest,
            new Slice(this.compactPointers[level])
          ) > 0
        ) {
          c.inputs[0].push(f)
          break
        }
      }
      if (c.inputs[0].length === 0) {
        c.inputs[0].push(this._current.files[level][0])
      }
    } else if (shouldSeekCompaction) {
      level = this._current.fileToCompactLevel
      c = new Compaction({}, level)
      c.inputs[0].push(this._current.fileToCompact)
    } else {
      return
    }

    c.inputVersion = this.current
    c.inputVersion.ref()

    if (level === 0) {
      // todo
      let smallest = new InternalKey()
      let largest = new InternalKey()
      this.getRange(c.inputs[0], smallest, largest)
      // Note that the next call will discard the file we placed in
      // c->inputs_[0] earlier and replace it with an overlapping set
      // which will include the picked file.
      this._current.getOverlappingInputs(0, smallest, largest, c.inputs[0])
      // this.getOverlappingInputs(0, )
      assert(c.inputs[0].length > 0)
    }
    this.setupOtherInputs(c)
    return c
  }

  /**
   * Stores the minimal range that covers all entries in inputs in
   * smallest, *largest.
   * REQUIRES: inputs is not empty
   */
  getRange(
    inputs: FileMetaData[],
    smallest: InternalKey,
    largest: InternalKey
  ) {
    assert(inputs.length > 0)
    smallest.clear()
    largest.clear()
    for (let i = 0; i < inputs.length; i++) {
      let fileMetaData = inputs[i]
      if (i === 0) {
        smallest.buffer = fileMetaData.smallest.buffer
        largest.buffer = fileMetaData.largest.buffer
      } else {
        if (
          this.internalKeyComparator.compare(fileMetaData.smallest, smallest) <
          0
        ) {
          smallest.buffer = fileMetaData.smallest.buffer
        }
        if (
          this.internalKeyComparator.compare(fileMetaData.largest, largest) > 0
        ) {
          largest.buffer = fileMetaData.largest.buffer
        }
      }
    }
  }

  /**
   * Stores the minimal range that covers all entries in inputs1 and inputs2
   * in *smallest, *largest.
   * REQUIRES: inputs is not empty
   */
  getRange2(
    inputs1: FileMetaData[],
    inputs2: FileMetaData[],
    smallest: InternalKey,
    largest: InternalKey
  ) {
    const all = inputs1.concat(inputs2)
    this.getRange(all, smallest, largest)
  }

  // Finds the largest key in a vector of files. Returns true if files it not
  // empty.
  findLargestKey(
    icmp: InternalKeyComparator,
    files: FileMetaData[],
    largestKey: InternalKey
  ): boolean {
    if (files.length === 0) return false
    largestKey = files[0].largest
    for (let i = 0; i < files.length; i++) {
      const f: FileMetaData = files[i]
      if (icmp.compare(f.largest, largestKey) > 0) {
        largestKey = f.largest
      }
    }
    return true
  }

  // Extracts the largest file b1 from |compaction_files| and then searches for a
  // b2 in |level_files| for which user_key(u1) = user_key(l2). If it finds such a
  // file b2 (known as a boundary file) it adds it to |compaction_files| and then
  // searches again using this new upper bound.
  //
  // If there are two blocks, b1=(l1, u1) and b2=(l2, u2) and
  // user_key(u1) = user_key(l2), and if we compact b1 but not b2 then a
  // subsequent get operation will yield an incorrect result because it will
  // return the record from b2 in level i rather than from b1 because it searches
  // level by level for records matching the supplied user key.
  //
  // parameters:
  //   in     level_files:      List of files to search for boundary files.
  //   in/out compaction_files: List of files to extend by adding boundary files.
  addBoundryInputs(
    icmp: InternalKeyComparator,
    levelFiles: FileMetaData[],
    compactionFiles: FileMetaData[]
  ) {
    let largestKey = new InternalKey()
    if (!this.findLargestKey(icmp, compactionFiles, largestKey)) {
      return
    }
    while (true) {
      const smallestBoundaryFile = this.findSmallestBoundaryFile(
        icmp,
        levelFiles,
        largestKey
      )
      if (!smallestBoundaryFile) break
      largestKey = smallestBoundaryFile.largest
      compactionFiles.push(smallestBoundaryFile)
    }
  }

  // Finds minimum file b2=(l2, u2) in level file for which l2 > u1 and
  // user_key(l2) = user_key(u1)
  findSmallestBoundaryFile(
    icmp: InternalKeyComparator,
    levelFiles: FileMetaData[],
    largestKey: InternalKey
  ): FileMetaData {
    const userComparator = icmp.getUserComparator()
    let smallestBoundryFile!: FileMetaData
    for (let i = 0; i < levelFiles.length; i++) {
      const f = levelFiles[i]
      if (
        icmp.compare(f.smallest, largestKey) > 0 &&
        userComparator.compare(
          f.smallest.extractUserKey(),
          largestKey.extractUserKey()
        ) === 0
      ) {
        if (
          !smallestBoundryFile ||
          icmp.compare(f.smallest, smallestBoundryFile.smallest) < 0
        ) {
          smallestBoundryFile = f
        }
      }
    }

    return smallestBoundryFile
  }

  setupOtherInputs(c: Compaction): void {
    const level = c.level
    let smallest = new InternalKey()
    let largest = new InternalKey()
    this.addBoundryInputs(
      this.internalKeyComparator,
      this._current.files[level],
      c.inputs[0]
    )
    this.getRange(c.inputs[0], smallest, largest)
    this.current.getOverlappingInputs(level + 1, smallest, largest, c.inputs[1])
    let allStart = new InternalKey()
    let allLimit = new InternalKey()
    this.getRange2(c.inputs[0], c.inputs[1], allStart, allLimit)
    if (c.inputs.length > 0) {
      let expand0: FileMetaData[] = []
      this.current.getOverlappingInputs(level, allStart, allLimit, expand0)
      this.addBoundryInputs(
        this.internalKeyComparator,
        this._current.files[level],
        expand0
      )
      const input0Size = this.getTotalBytes(c.inputs[0])
      const input1Size = this.getTotalBytes(c.inputs[1])
      const expand0Size = this.getTotalBytes(expand0)
      if (
        expand0.length > c.inputs[0].length &&
        input1Size + expand0Size <
          getExpandedCompactionByteSizeLimit(this._options)
      ) {
        let newStart = new InternalKey()
        let newLimit = new InternalKey()
        this.getRange(expand0, newStart, newLimit)
        let expand1: FileMetaData[] = []
        this._current.getOverlappingInputs(
          level + 1,
          newStart,
          newLimit,
          expand1
        )
        if (expand1.length === c.inputs[1].length) {
          // todo log expanding size
          smallest = newStart
          largest = newLimit
          c.inputs[0] = expand0
          c.inputs[1] = expand1
          this.getRange2(c.inputs[0], c.inputs[1], allStart, allLimit)
        }
      }
    }

    // Compute the set of grandparent files that overlap this compaction
    // (parent == level+1; grandparent == level+2)
    if (level + 2 < Config.kNumLevels) {
      this._current.getOverlappingInputs(
        level + 2,
        allStart,
        allLimit,
        c.grandparents
      )
    }

    // Update the place where we will do the next compaction for this level.
    // We update this immediately instead of waiting for the VersionEdit
    // to be applied so that if the compaction fails, we will try a different
    // key range next time.
    this.compactPointers[level] = largest.toString()
    c.edit.compactPointers.push({ level, internalKey: largest })
  }
}
