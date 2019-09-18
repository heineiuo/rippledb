/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow

import fs from 'fs'
import Version from './Version'
import { getCurrentFilename, getManifestFilename } from './Filename'
import { type CompactPointer, InternalKeyComparator, getMaxBytesForLevel } from './VersionFormat'
import VersionBuilder from './VersionBuilder'
import VersionEditRecord from './VersionEditRecord'
import LogReader from './LogReader'
import MemTable from './MemTable'
import VersionEdit from './VersionEdit'
import { Config } from './Format'

export default class VersionSet {
  compactPointers: CompactPointer[]
  _manifestFileNumber: number
  _current: Version
  hasLogNumber: boolean
  hasNextFileNumber: boolean
  hasPrevLogNumber: boolean
  logNumber: number

  // if prevLogNumber is 0, then no log file is being compacted
  prevLogNumber: number
  lastSequence: number
  hasLastSequence: boolean
  manifestFileNumber: number
  nextFileNumber:number

  _dbpath: string
  _options: any
  _memtable: MemTable
  internalKeyComparator: InternalKeyComparator

  constructor (dbpath: string, options: any, memtable: MemTable, internalKeyComparator: InternalKeyComparator) {
    this._dbpath = dbpath
    this._options = options
    this._memtable = memtable
    this.internalKeyComparator = internalKeyComparator
    this.appendVersion(new Version(this))
    this.compactPointers = []
  }

  get current (): Version {
    return this._current
  }

  getNextFileNumber () {
    return this.nextFileNumber++
  }

  async recover () {
  // 读取current， 校验是否是\n结尾
    const current = await fs.promises.readFile(getCurrentFilename(this._dbpath), 'utf8')
    if (!current || current[current.length - 1] !== '\n') {
      throw new Error('Invalid format of CURRENT file.')
    }

    let hasLogNumber = false
    let hasNextFileNumber = false
    let hasPrevLogNumber = false
    let hasLastSequence = 0
    let logNumber = 0
    let nextFileNumber = 0
    let prevLogNumber = 0
    let lastSequence = 0

    const builder = new VersionBuilder(this, this._current)
    const currentValue = current.substr(0, current.length - 1)
    const manifestNumber = Number(currentValue.substr('MANIFEST-'.length))

    // 根据current读取dscfile(description file), 即manifest文件
    const reader = new LogReader(getManifestFilename(this._dbpath, manifestNumber), VersionEditRecord)
    // 读取record，apply到versionSet(apply方法)
    // 更新log number和prev log number（可省略，因为prevlognumber其实被废弃了）
    // 更新next file
    // 更新last sequence
    // 通过version builder 创建一个新的version
    for await (let edit: VersionEdit of reader.iterator()) {
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

  markFileNumberUsed (num:number) {
    if (this.nextFileNumber <= num) {
      this.nextFileNumber = num + 1
    }
  }

  del (version: Version) {

  }

  add (version: Version) {

  }

  // Precomputed best level for next compaction
  finalize (ver: Version) {
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

  logAndApply (edit:VersionEdit) {

  }

  /**
     * 主要目的是更新this._current
     */
  appendVersion (ver: Version): void {
    this._current = ver
  }

  reuseManifest () {
    return false
  }

  /**
   * 将current写入manifest
   */
  writeSnapshot () {

  }
}
