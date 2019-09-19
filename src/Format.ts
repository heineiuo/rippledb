/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

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

export enum RecordType {
  // Zero is reserved for preallocated files
  kZeroType = 0,

  kFullType = 1,

  // For fragments
  kFirstType = 2,
  kMiddleType = 3,
  kLastType = 4,
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

export const kBlockSize = 32768 // 32KB
export const kMemTableDumpSize = 4194304 // 4MB

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

export const kInternalKeyComparatorName = 'leveldb.InternalKeyComparator'
