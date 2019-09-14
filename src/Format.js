/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

import Enum from 'enum'
import varint from 'varint'
import Slice from './Slice'
import SequenceNumber from './SequenceNumber'

export const FileType = new Enum([
  'kLogFile',
  'kDBLockFile',
  'kTableFile',
  'kDescriptorFile',
  'kCurrentFile',
  'kTempFile',
  'kInfoLogFile' // Either the current one, or an old one
])

export const ValueType = new Enum({
  kTypeDeletion: 0x00,
  kTypeValue: 0x01
})

export const RecordType = new Enum({
  // Zero is reserved for preallocated files
  kZeroType: 0,

  kFullType: 1,

  // For fragments
  kFirstType: 2,
  kMiddleType: 3,
  kLastType: 4
})

export const kBlockSize = 32768 // 32KB
export const kMemTableDumpSize = 4194304 // 4MB

export const VersionEditTag = new Enum({
  kComparator: 1,
  kLogNumber: 2,
  kNextFileNumber: 3,
  kLastSequence: 4,
  kCompactPointer: 5,
  kDeletedFile: 6,
  kNewFile: 7,
  // 8 was used for large value refs
  kPrevLogNumber: 9
})

export const CompressionTypes = new Enum({
  none: 0
})

export const kInternalKeyComparatorName = 'leveldb.InternalKeyComparator'

export class InternalKey {
  constructor (slice:Slice) {
    this._slice = Slice
  }

  _slice:Slice
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
      sequence.toFixedSizeBuffer(),
      Buffer.from(varint.encode(valueType.value))
    ]))
    return new InternalKey(slice)
  }
}

export class InternalKeyComparator {

}
