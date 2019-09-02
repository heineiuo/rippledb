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
