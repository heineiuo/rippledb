/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

import Enum from 'enum'

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
