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
import {
  CompactPointer,
  InternalKeyComparator,
  getMaxBytesForLevel,
} from './VersionFormat'
import VersionBuilder from './VersionBuilder'
import VersionEditRecord from './VersionEditRecord'
import LogReader from './LogReader'
import MemTable from './MemTable'
import VersionEdit from './VersionEdit'
import { Config } from './Format'
import LogWriter from './LogWriter'

export default class VersionSet {
  compactPointers: CompactPointer[]
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

  get current(): Version | undefined {
    return this._current
  }

  getNextFileNumber(): number {
    return this.nextFileNumber++
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
      getManifestFilename(this._dbpath, manifestNumber),
      VersionEditRecord
    )
    // 读取record，apply到versionSet(apply方法)
    // 更新log number和prev log number（可省略，因为prevlognumber其实被废弃了）
    // 更新next file
    // 更新last sequence
    // 通过version builder 创建一个新的version
    for await (let edit of reader.iterator()) {
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

  del(version: Version) {}

  add(version: Version) {}

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
        score = ver.files[level].size() / Config.kL0CompactionTrigger
      } else {
        const levelBytes = ver.files[level].totalBytes()
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
}
