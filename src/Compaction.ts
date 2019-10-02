/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileMetaData, InternalKey } from './VersionFormat'
import Version from './Version'
import VersionEdit from './VersionEdit'
import { Options } from './Options'
import SequenceNumber from './SequenceNumber'
import Slice from './Slice'
import SSTableBuilder from './SSTableBuilder'
import { Config } from './Format'
import { FileHandle } from './Env'

export default class Compaction {
  static targetFileSize(options: Options) {
    return options.maxFileSize
  }

  static maxGrandParentOverlapBytes(options: Options) {
    return 10 * Compaction.targetFileSize(options)
  }

  static totalFileSize(files: FileMetaData[]) {
    let sum = 0
    for (let file of files) {
      sum += file.fileSize
    }
    return sum
  }

  static maxFileSizeForLevel(options: Options, level: number) {
    // We could vary per level to reduce number of files?
    return Compaction.targetFileSize(options)
  }

  level: number
  inputVersion!: Version
  grandparents!: FileMetaData[]
  grandparentIndex: number // Index in grandparent_starts_
  seenKey: boolean
  overlappedBytes: number
  edit!: VersionEdit
  _maxOutputFilesize: number

  // level_ptrs_ holds indices into input_version_->levels_: our state
  // is that we are positioned at one of the file ranges for each
  // higher level than the ones involved in this compaction (i.e. for
  // all L >= level_ + 2).
  private levelPtrs: number[]

  // Each compaction reads inputs from "level_" and "level_+1"
  inputs!: [FileMetaData[], FileMetaData[]]

  constructor(options: any, level: number) {
    this.level = level
    this.grandparentIndex = 0
    this.overlappedBytes = 0
    this.seenKey = false
    this.inputs = [[], []]
    this._maxOutputFilesize = Compaction.maxFileSizeForLevel(options, level)
    this.levelPtrs = Array.from({ length: Config.kNumLevels }, () => 0)
  }

  get maxOutputFilesize() {
    return this._maxOutputFilesize
  }

  ssTrivialMove(): boolean {
    return false
  }

  numInputFiles(which: 0 | 1): number {
    return this.inputs[which].length
  }

  // Is this a trivial compaction that can be implemented by just
  // moving a single input file to the next level (no merging or splitting)
  public isTrivialMode(): boolean {
    const versionSet = this.inputVersion.versionSet
    // Avoid a move if there is lots of overlapping grandparent data.
    // Otherwise, the move could create a parent file that will require
    // a very expensive merge later on.
    return (
      this.numInputFiles(0) === 1 &&
      this.numInputFiles(1) === 0 &&
      Compaction.totalFileSize(this.grandparents) <=
        Compaction.maxGrandParentOverlapBytes(versionSet._options)
    )
  }

  // Returns true if the information we have available guarantees that
  // the compaction is producing data in "level+1" for which no data exists
  // in levels greater than "level+1".
  public isBaseLevelForKey(userKey: Slice): boolean {
    const userComparator = this.inputVersion.versionSet.internalKeyComparator
      .userComparator
    for (let level = this.level + 2; level < Config.kNumLevels; level++) {
      const files = this.inputVersion.files[level]
      while (this.levelPtrs[level] < files.length) {
        const f = files[this.levelPtrs[level]]
        if (userComparator.compare(userKey, f.largest.extractUserKey()) <= 0) {
          // We've advanced far enough
          if (
            userComparator.compare(userKey, f.smallest.extractUserKey()) >= 0
          ) {
            // Key falls in this file's range, so definitely not base level
            return false
          }
          break
        }
        this.levelPtrs[level]++
      }
    }
    return true
  }

  // Release the input version for the compaction, once the compaction
  // is successful.
  public releaseInputs() {
    if (!!this.inputVersion) {
      this.inputVersion.unref()
      delete this.inputVersion
    }
  }

  /**
   * Returns true if we should stop building the current output
   * before processing "internalKey".
   */
  public shouldStopBefore(internalKey: Slice): boolean {
    const versionSet = this.inputVersion.versionSet
    const icmp = versionSet.internalKeyComparator
    while (
      this.grandparentIndex < this.grandparents.length &&
      icmp.compare(
        internalKey,
        this.grandparents[this.grandparentIndex].largest
      ) > 0
    ) {
      if (this.seenKey) {
        this.overlappedBytes += this.grandparents[
          this.grandparentIndex
        ].fileSize
      }
      this.grandparentIndex++
    }
    this.seenKey = true
    if (
      this.overlappedBytes >
      Compaction.maxGrandParentOverlapBytes(versionSet._options)
    ) {
      this.overlappedBytes = 0
      return true
    } else {
      return false
    }
  }

  // Add all inputs to this compaction as delete operations to *edit.
  public addInputDeletions(edit: VersionEdit) {
    for (let which = 0; which < 2; which++) {
      for (let i = 0; i < this.inputs[which].length; i++) {
        edit.deleteFile(this.level + which, this.inputs[which][i].number)
      }
    }
  }
}

export interface CompactionStateOutput {
  number: number
  fileSize: number
  smallest: InternalKey
  largest: InternalKey
}

export class CompactionStats {
  times: number
  bytesRead: number
  bytesWritten: number
  constructor() {
    this.times = 0
    this.bytesRead = 0
    this.bytesWritten = 0
  }

  add(c: CompactionStats) {
    this.times += c.times
    this.bytesRead += c.bytesRead
    this.bytesWritten += c.bytesWritten
  }
}

export class CompactionState {
  outputs!: CompactionStateOutput[]
  smallestSnapshot: number
  compaction: Compaction
  outfile!: FileHandle
  builder!: SSTableBuilder
  public totalBytes: number

  constructor(c: Compaction) {
    this.compaction = c
    this.smallestSnapshot = 0
    this.totalBytes = 0
  }

  currentOutput(): CompactionStateOutput {
    return this.outputs[this.outputs.length - 1]
  }
}
