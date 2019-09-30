/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import { ValueType } from './Format'
import varint from 'varint'
import Slice from './Slice'
import SequenceNumber from './SequenceNumber'
import { Options } from './Options'
import { decodeFixed64 } from './Coding'

export class ParsedInternalKey {
  userKey!: Slice
  sn!: SequenceNumber
  valueType!: ValueType
  constructor(userKey?: Slice, sn?: SequenceNumber, valueType?: ValueType) {
    if (
      typeof userKey !== 'undefined' &&
      typeof sn !== 'undefined' &&
      typeof valueType !== 'undefined'
    ) {
      this.userKey = userKey
      this.sn = sn
      this.valueType = valueType
    }
  }
}

export class InternalKey extends Slice {
  // We leave eight bits empty at the bottom so a type and sequence#
  // can be packed together into 64-bits.
  // in c++ , it is (0x1llu << 56) -1, 72057594037927935
  // in javascript , Math.pow(2, 56) - 1 = 72057594037927940, Math.pow(2, 56) - 5 = 72057594037927930
  // so , use 72057594037927935 directly
  static kMaxSequenceNumber = new SequenceNumber(72057594037927935)

  // Attempt to parse an internal key from "internal_key".  On success,
  // stores the parsed data in "*result", and returns true.
  //
  // On error, returns false, leaves "*result" in an undefined state.
  static parseInternalKey(key: Slice, ikey: ParsedInternalKey): boolean {
    ikey.userKey = InternalKey.extractUserKey(key)
    ikey.sn = new SequenceNumber(
      decodeFixed64(key.buffer.slice(key.length - 8))
    )
    ikey.valueType = varint.decode(key.buffer.slice(key.length - 1))
    return true
  }

  static extractUserKey(slice: Slice): Slice {
    assert(slice.size > 8)
    return new Slice(slice.buffer.slice(0, slice.size - 8))
  }

  constructor(userKey?: Slice, sn?: SequenceNumber, valueType?: ValueType) {
    super()
    if (
      typeof userKey !== 'undefined' &&
      typeof sn !== 'undefined' &&
      typeof valueType !== 'undefined'
    ) {
      this.appendInternalKey(
        this.buffer,
        new ParsedInternalKey(userKey, sn, valueType)
      )
    }
  }

  public decodeFrom(slice: Slice) {
    this.buffer = slice.buffer
    return this.size > 0
  }

  // Append the serialization of "key" to *result.
  appendInternalKey(buf: Buffer, key: ParsedInternalKey) {
    const sequenceBuf = key.sn.toFixed64Buffer()
    sequenceBuf.fill(key.valueType, 7, 8)
    this.buffer = Buffer.concat([this.buffer, key.userKey.buffer, sequenceBuf])
  }

  extractUserKey = (): Slice => {
    assert(this.size > 8)
    return new Slice(this.buffer.slice(0, this.size - 8))
  }
}

export class InternalKeyBuilder {
  build(
    sequence: SequenceNumber,
    valueType: ValueType,
    key: Slice
  ): InternalKey {
    /**
     * encoded(internal_key_size) | key | sequence(7Bytes) | type (1Byte) | encoded(value_size) | value
     * 1. Lookup key/ Memtable Key: encoded(internal_key_size) --- type(1Byte)
     * 2. Internal key: key --- type(1Byte)
     * 3. User key: key
     */
    const sequenceBuf = sequence.toFixed64Buffer()
    sequenceBuf.fill(valueType, 7, 8)
    const slice = new Slice(Buffer.concat([key.buffer, sequenceBuf]))
    return new InternalKey(slice)
  }
}

export class Comparator {
  getName(): string {
    return '0'
  }

  compare(key1: Slice, key2: Slice) {
    return key1.compare(key2)
  }

  findShortestSeparator() {}

  findShortSuccessor() {}
}

export class InternalKeyComparator {
  static extractUserKey(slice: Slice) {
    assert(slice.size > 8)
    return new Slice(slice.buffer.slice(0, slice.size - 8))
  }

  getUserComparator() {
    return this.userComparator
  }

  userComparator: Comparator

  constructor(userComparator: Comparator = new Comparator()) {
    this.userComparator = userComparator
  }

  compare(key1: Slice, key2: Slice): number {
    // first compare user key
    const userKey1 = InternalKeyComparator.extractUserKey(key1)
    const userKey2 = InternalKeyComparator.extractUserKey(key2)
    const r = this.userComparator.compare(userKey1, userKey2)
    if (r !== 0) return r
    // then compare sequence number
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
  internalComparator: InternalKeyComparator

  constructor(cmp: InternalKeyComparator) {
    this.internalComparator = cmp
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

export const kValueTypeForSeek = ValueType.kTypeValue

export interface Entry {
  sequence?: SequenceNumber
  type?: ValueType
  key: Slice
  value: Slice
}

export interface EntryRequireType extends Entry {
  type: ValueType
}

export interface GetStats {
  seekFile: FileMetaData
  seekFileLevel: number
}
