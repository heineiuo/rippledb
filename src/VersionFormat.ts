/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

/* global Generator */

import assert from 'assert'
import { ValueType } from './Format'
import varint from 'varint'
import Slice from './Slice'
import SequenceNumber from './SequenceNumber'

export class InternalKey extends Slice {
  extractUserKey ():Slice {
    return new Slice(this.buffer.slice(0, this.size - 8))
  }
}

export class InternalKeyBuilder {
  build (sequence:SequenceNumber, valueType:ValueType, key:Slice):InternalKey {
    /**
     * encoded(internal_key_size) | key | sequence(7Bytes) | type (1Byte) | encoded(value_size) | value
     * 1. Lookup key/ Memtable Key: encoded(internal_key_size) --- type(1Byte)
     * 2. Internal key: key --- type(1Byte)
     * 3. User key: key
     */
    const slice = new Slice(Buffer.concat([
      key.buffer,
      sequence.toFixedSizeBuffer(7),
      Buffer.from(varint.encode(valueType.value))
    ]))
    return new InternalKey(slice)
  }
}

class Comparator {
  static name () {
    return 0
  }

  static compare (key1:Slice, key2:Slice) {
    return key1.compare(key2)
  }

  static findShortestSeparator () {

  }

  static findShortSuccessor () {

  }
}

export class InternalKeyComparator {
  static extractUserKey (slice:Slice) {
    assert(slice.size > 8)
    return new Slice(slice.buffer.slice(0, slice.size - 8))
  }

  userComparator:Comparator

  constructor (userComparator: Comparator = Comparator) {
    this.userComparator = userComparator
  }

  compare (key1:Slice, key2:Slice):number {
    // 先比较user key
    const userKey1 = InternalKeyComparator.extractUserKey(key1)
    const userKey2 = InternalKeyComparator.extractUserKey(key2)
    const r = this.userComparator.compare(userKey1, userKey2)
    if (r !== 0) return r
    // 再比较sequence number
    const sn1 = varint.decode(key1.buffer, key1.size - 8)
    const sn2 = varint.decode(key2.buffer, key2.size - 8)
    if (sn1 === sn2) return 0
    return sn1 > sn2 ? -1 : 1
  }
}

export class FileMetaData {
  // reference count
  refs: number
  // if seeks > allowedSeeks, trigger compaction
  allowedSeeks: number
  number: number
  fileSize: number
  smallest: InternalKey
  largest: InternalKey

  constructor (args: any) {
    this.refs = args.refs
    this.allowedSeeks = args.allowedSeeks
    this.number = args.number
    this.fileSize = args.fileSize
    this.smallest = new InternalKey(args.smallest)
    this.largest = new InternalKey(args.largest)
  }
}

export class BySmallestKey {
  internalComparator:InternalKeyComparator

  constructor (cmp:InternalKeyComparator) {
    this.internalComparator = cmp
  }

  // if file1 < file2 then true
  operator (file1: FileMetaData, file2: FileMetaData):boolean {
    const r = this.internalComparator.compare(file1.smallest, file2.smallest)
    if (r === 0) return file1.number < file2.number
    return r < 0
  }
}

// 能自动排序的set（根据internalkey comparator排序，如果small key相同，则比较file number
// 目前不拷贝插入的值，而是引用
export class FileSet {
  _set: FileMetaData[]
  compare: BySmallestKey

  constructor (cmp:BySmallestKey) {
    this.compare = cmp
    this._set = []
  }

  add (file: FileMetaData) {
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

  push (file: FileMetaData) {
    const endFile = this.end()
    assert(!endFile || this.compare.operator(endFile, file))
    this._set.push(file)
  }

  begin ():FileMetaData | null {
    return this._set[0] || null
  }

  end ():FileMetaData | null {
    return this._set[this._set.length - 1] || null
  }

  delete (file:FileMetaData) {
    this._set = this._set.filter(item => item !== file)
  }

  size ():number {
    return this._set.length
  }

  totalBytes ():number {
    let bytes = 0
    for (let fileMetaData of this.iterator()) {
      bytes += fileMetaData.fileSize
    }
    return bytes
  }

  * iterator ():Generator<FileMetaData, void, void> {
    const setLength = this._set.length
    for (let i = 0; i < setLength; i++) {
      yield this._set[i]
    }
  }
}

export type FileMetaDataLeveldb = {
  fileNum:number,
  fileSize:number,
  smallestKey:InternalKey,
  largestKey:InternalKey
}

export type CompactPointer = {
  level:number,
  internalKey:InternalKey
}

export type DeletedFile = {
  level: number,
  fileNum: number
}

export type NewFile = {
  level:number,
  fileMetaData: FileMetaData
}

export function getMaxBytesForLevel (level:number) {
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
