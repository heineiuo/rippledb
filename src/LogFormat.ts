/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Slice from './Slice'

export enum RecordType {
  // Zero is reserved for preallocated files
  kZeroType = 0,

  kFullType = 1,

  // For fragments
  kFirstType = 2,
  kMiddleType = 3,
  kLastType = 4,
}

export function createHexStringFromDecimal(decimal: number): string {
  let str = decimal.toString(16)
  while (str.length < 4) {
    str = `0${str}`
  }
  return str
}

export interface Record {
  length: number
  type: number
  data: Slice
}

export const kMaxRecordType = RecordType.kLastType

export const kBlockSize = 32768

// Header is checksum (4 bytes), length (2 bytes), type (1 byte).
export const kHeaderSize = 4 + 2 + 1
