/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import varint from 'varint'
import Slice from './Slice'
import { Comparator } from './Comparator'
import { decodeFixed64, encodeFixed64, decodeFixed32 } from './Coding'
import BloomFilter from './BloomFilter'

export enum FileType {
  kLogFile,
  kDBLockFile,
  kTableFile,
  kDescriptorFile,
  kCurrentFile,
  kTempFile,
  kInfoLogFile, // Either the current one, or an old one
}

export enum ValueType {
  kTypeDeletion = 0x00,
  kTypeValue = 0x01,
}

export const kValueTypeForSeek = ValueType.kTypeValue

export const kMaxSequenceNumber: bigint = (1n << 56n) - 1n

function packSequenceAndType(seq: number | bigint, t: ValueType): bigint {
  let bSeq = BigInt(seq)
  assert(bSeq <= kMaxSequenceNumber)
  assert(t <= kValueTypeForSeek)
  return (bSeq << 8n) | BigInt(t)
}

// Append the serialization of "key" to *result.
function appendInternalKey(buf: Buffer, key: ParsedInternalKey): Buffer {
  const sequenceBuf = key.sn.toFixed64Buffer()
  sequenceBuf.fill(key.valueType, 7, 8)
  return Buffer.concat([buf, key.userKey.buffer, sequenceBuf])
}

export enum VersionEditTag {
  kComparator = 1,
  kLogNumber = 2,
  kNextFileNumber = 3,
  kLastSequence = 4,
  kCompactPointer = 5,
  kDeletedFile = 6,
  kNewFile = 7,
  // 8 was used for large value refs
  kPrevLogNumber = 9,
}

export enum CompressionTypes {
  none = 0x00,
}

export const kMemTableDumpSize = 4194304 // 4MB

// TODO maybe SequenceNumber should use bigint all time?
// bigint to buffer:
//   let bnum = (1n << 56n) - 1n
//   Buffer.from(bnum.toString(16), 'hex') // <Buffer ff ff ff ff ff ff ff>
//  buf to bigint:
//   let bnum = BigInt(`0x${buf.toString('hex')}`)
export class SequenceNumber {
  // bigint?
  constructor(initial: number = 0) {
    this._value = initial
  }

  private _value: number

  get value(): number {
    return this._value
  }

  set value(value) {
    this._value = value
  }

  toBuffer(): Buffer {
    return Buffer.from(varint.encode(this._value))
  }

  public toFixed64Buffer = (): Buffer => {
    return encodeFixed64(this._value)
  }
}

// Returns the user key portion of an internal key.
export function extractUserKey(ikey: Slice): Slice {
  assert(ikey.size > 8)
  return new Slice(ikey.buffer.slice(0, ikey.size - 8))
}

export class InternalKey extends Slice {
  // We leave eight bits empty at the bottom so a type and sequence#
  // can be packed together into 64-bits.
  // in c++ , it is (0x1llu << 56) -1, 72057594037927935
  // in javascript , Math.pow(2, 56) - 1 = 72057594037927940, Math.pow(2, 56) - 5 = 72057594037927930
  // so , use 72057594037927935 directly
  static kMaxSequenceNumber = new SequenceNumber(72057594037927935)

  static from(slice: Slice): InternalKey {
    const internalKey = new InternalKey()
    assert(internalKey.decodeFrom(slice))
    return internalKey
  }

  constructor(userKey?: Slice, sn?: SequenceNumber, valueType?: ValueType) {
    super()
    if (
      typeof userKey !== 'undefined' &&
      typeof sn !== 'undefined' &&
      typeof valueType !== 'undefined'
    ) {
      this.buffer = appendInternalKey(
        this.buffer,
        new ParsedInternalKey(userKey, sn, valueType)
      )
    }
  }

  get userKey() {
    return extractUserKey(this)
  }

  get type(): ValueType {
    return this.buffer[this.buffer.length - 1]
  }

  get sequence(): number {
    const sequenceBuf = Buffer.alloc(8)
    sequenceBuf.fill(this.buffer.slice(this.buffer.length - 8), 0, 7)
    return decodeFixed32(sequenceBuf)
  }

  public decodeFrom(slice: Slice) {
    this.buffer = slice.buffer
    return this.buffer.length > 0
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

// 1-byte type + 32-bit crc
export const kBlockTrailerSize = 5

export class Config {
  static kNumLevels = 7 // 0...6

  // Level-0 compaction is started when we hit this many files.
  static kL0CompactionTrigger = 4

  // Soft limit on number of level-0 files.  We slow down writes at this point.
  static kL0SlowdownWritesTrigger = 8

  // Maximum number of level-0 files.  We stop writes at this point.
  static kL0StopWritesTrigger = 12

  // Maximum level to which a new compacted memtable is pushed if it
  // does not create overlap.  We try to push to level 2 to avoid the
  // relatively expensive level 0=>1 compactions and to avoid some
  // expensive manifest file operations.  We do not push all the way to
  // the largest level since that can generate a lot of wasted disk
  // space if the same key space is being repeatedly overwritten.
  static kMaxMemCompactLevel = 2

  // Approximate gap in bytes between samples of data read during iteration.
  static kReadBytesPeriod = 1048576
}

export const kSizeOfUInt32 = 4

export class InternalKeyComparator implements Comparator {
  constructor(userComparator: Comparator) {
    this._userComparator = userComparator
  }

  private _userComparator: Comparator

  get userComparator() {
    return this._userComparator
  }

  getName(): string {
    return 'leveldb.InternalKeyComparator'
  }

  findShortestSeparator(start: Slice, limit: Slice) {
    // Attempt to shorten the user portion of the key
    const userStart = extractUserKey(start)
    const userLimit = extractUserKey(limit)
    const tmp = new Slice(Buffer.from(userStart.buffer))
    this.userComparator.findShortestSeparator(tmp, userLimit)

    if (
      tmp.size < userStart.size &&
      this.userComparator.compare(userStart, tmp) < 0
    ) {
      // User key has become shorter physically, but larger logically.
      // Tack on the earliest possible number to the shortened user key.
      tmp.buffer = Buffer.concat([
        tmp.buffer,
        encodeFixed64(
          packSequenceAndType(kMaxSequenceNumber, kValueTypeForSeek)
        ),
      ])
      assert(this.compare(start, tmp) < 0)
      assert(this.compare(tmp, limit) < 0)
      start.buffer = tmp.buffer
    }
  }

  findShortSuccessor(key: Slice) {
    const userKey = extractUserKey(key)
    const tmp = new Slice(Buffer.from(userKey.buffer))
    this._userComparator.findShortSuccessor(tmp)
    if (
      tmp.size < userKey.size &&
      this._userComparator.compare(userKey, tmp) < 0
    ) {
      // User key has become shorter physically, but larger logically.
      // Tack on the earliest possible number to the shortened user key.
      tmp.buffer = Buffer.concat([
        tmp.buffer,
        encodeFixed64(
          packSequenceAndType(kMaxSequenceNumber, kValueTypeForSeek)
        ),
      ])
      assert(this.compare(key, tmp) < 0)
      key.buffer = tmp.buffer
    }
  }

  // key1 and key2 is internal key buffer
  compare(key1: Slice, key2: Slice): number {
    // Order by:
    //    increasing user key (according to user-supplied comparator)
    //    decreasing sequence number
    //    decreasing type (though sequence# should be enough to disambiguate)
    const userKey1 = extractUserKey(key1)
    const userKey2 = extractUserKey(key2)
    const r = this.userComparator.compare(userKey1, userKey2)
    if (r !== 0) return r
    const sn1Buf = Buffer.alloc(8)
    const sn2Buf = Buffer.alloc(8)
    sn1Buf.fill(key1.buffer.slice(key1.size - 8), 0, 7)
    sn2Buf.fill(key2.buffer.slice(key2.size - 8), 0, 7)

    const sn1 = decodeFixed64(sn1Buf)
    const sn2 = decodeFixed64(sn2Buf)
    if (sn1 === sn2) return 0
    return sn1 > sn2 ? -1 : 1
  }
}

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

// Attempt to parse an internal key from "internal_key".  On success,
// stores the parsed data in "*result", and returns true.
//
// On error, returns false, leaves "*result" in an undefined state.
export function parseInternalKey(
  internalKey: Slice,
  ikey: ParsedInternalKey
): boolean {
  ikey.userKey = extractUserKey(internalKey)
  const snBuf = Buffer.alloc(8)
  snBuf.fill(internalKey.buffer.slice(internalKey.length - 8), 0, 7)
  ikey.sn = new SequenceNumber(decodeFixed64(snBuf))
  ikey.valueType = internalKey.buffer[internalKey.length - 1]
  return true
}

export class LookupKey {
  private _buffer: Buffer
  private _internalKeyBuf: Buffer
  private _userKeyBuf: Buffer

  // We construct a char array of the form:
  //    klength  varint32               <-- start_
  //    userkey  char[klength]          <-- kstart_
  //    tag      uint64
  //                                    <-- end_
  // The array is a suitable MemTable key.
  // The suffix starting with "userkey" can be used as an InternalKey.
  constructor(userKey: Slice, sequence: SequenceNumber) {
    const keySize = userKey.size
    const internalKeySize = keySize + 8
    const internalKeySizeBuf = Buffer.from(varint.encode(internalKeySize))
    const sequenceBuf = sequence.toFixed64Buffer()
    sequenceBuf.fill(Buffer.from(varint.encode(kValueTypeForSeek)), 7)
    const buf = Buffer.concat([internalKeySizeBuf, userKey.buffer, sequenceBuf])
    this._internalKeyBuf = buf.slice(internalKeySizeBuf.length)
    this._userKeyBuf = userKey.buffer
    this._buffer = buf
  }

  get internalKey(): Slice {
    return new Slice(this._internalKeyBuf)
  }

  get memKey(): Slice {
    return new Slice(this._buffer)
  }

  get userKey(): Slice {
    return new Slice(this._userKeyBuf)
  }
}

export interface Entry {
  sequence?: SequenceNumber
  type?: ValueType
  key: Slice // this is internal key in most situation, except filter key
  value: Slice
}

export interface EntryRequireType extends Entry {
  type: ValueType
}

export interface Filter extends BloomFilter {}

export class BlockHandle {
  static from(buf: Buffer) {
    const handle = new BlockHandle()
    handle.offset = varint.decode(buf)
    handle.size = varint.decode(buf, varint.decode.bytes)
    return handle
  }

  offset!: number
  size!: number

  get buffer(): Buffer {
    assert(typeof this.offset === 'number')
    assert(typeof this.size === 'number')
    return Buffer.concat([
      Buffer.from(varint.encode(this.offset)),
      Buffer.from(varint.encode(this.size)),
    ])
  }
}

export interface MetaBlockEntry {
  name: string
  handle: BlockHandle
}

export interface DataBlockEntry {
  largest: Slice // a key >= largest key in the data block
  handle: BlockHandle
}

export interface BlockContents {
  data: Slice // Actual contents of data
  cachable: boolean // True iff data can be cached
  heapAllocated: boolean // True iff caller should delete[] data.data()
}
