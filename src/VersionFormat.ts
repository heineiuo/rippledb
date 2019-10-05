/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import {
  ValueType,
  SequenceNumber,
  InternalKeyComparator,
  InternalKey,
} from './Format'
import Slice from './Slice'
import { Options } from './Options'
import { decodeFixed64 } from './Coding'

export class FileMetaData {
  // reference count
  refs: number
  // if seeks > allowedSeeks, trigger compaction
  allowedSeeks: number
  fileSize: number
  number!: number
  smallest!: InternalKey
  largest!: InternalKey

  constructor() {
    this.refs = 0
    this.allowedSeeks = 1 << 30
    this.fileSize = 0
  }
}

export class BySmallestKey {
  internalComparator!: InternalKeyComparator

  constructor(cmp?: InternalKeyComparator) {
    if (cmp) this.internalComparator = cmp
  }

  // if file1 < file2 then true
  operator(file1: FileMetaData, file2: FileMetaData): boolean {
    const r = this.internalComparator.compare(file1.smallest, file2.smallest)
    if (r === 0) return file1.number < file2.number
    return r < 0
  }
}

// sorted set（compared by internalkey comparator, if small key
// is equal then compare file number
// TODO not copy inserted value here, just reference, should copy?
export class FileSet {
  _set: FileMetaData[]
  compare: BySmallestKey

  constructor(cmp: BySmallestKey) {
    this.compare = cmp
    this._set = []
  }

  add(file: FileMetaData) {
    if (this._set.find(item => item === file)) {
      return
    }
    const setLength = this._set.length
    if (setLength === 0) {
      this._set.push(file)
    } else {
      for (let i = 0; i < setLength; i++) {
        const file1 = this._set[i]
        const b = this.compare.operator(file, file1)
        if (b) {
          this._set.splice(i, 0, file)
          break
        }
      }
      this._set.push(file)
    }
  }

  push(file: FileMetaData) {
    const endFile = this.end()
    assert(!endFile || this.compare.operator(endFile, file))
    this._set.push(file)
  }

  begin(): FileMetaData {
    return this._set[0]
  }

  end(): FileMetaData | null {
    return this._set[this._set.length - 1] || null
  }

  delete(file: FileMetaData) {
    this._set = this._set.filter(item => item !== file)
  }

  size(): number {
    return this._set.length
  }

  totalBytes(): number {
    let bytes = 0
    for (let fileMetaData of this.iterator()) {
      bytes += fileMetaData.fileSize
    }
    return bytes
  }

  get data() {
    return this._set
  }

  *iterator() {
    const setLength = this._set.length
    for (let i = 0; i < setLength; i++) {
      yield this._set[i]
    }
  }
}

export type FileMetaDataLeveldb = {
  fileNum: number
  fileSize: number
  smallestKey: InternalKey
  largestKey: InternalKey
}

export type CompactPointer = {
  level: number
  internalKey: InternalKey
}

export type DeletedFile = {
  level: number
  fileNum: number
}

export type NewFile = {
  level: number
  fileMetaData: FileMetaData
}

export function getMaxBytesForLevel(level: number) {
  // Note: the result for level zero is not really used since we set
  // the level-0 compaction threshold based on number of files.
  // Result for both level-0 and level-1
  let result = 10.0 * 1048576.0
  while (level > 1) {
    result *= 10
    level--
  }
  return result
}

export function getExpandedCompactionByteSizeLimit(options: Options) {
  return 25 * options.maxFileSize
}

export interface GetStats {
  seekFile: FileMetaData
  seekFileLevel: number
}
