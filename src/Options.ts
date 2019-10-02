/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BytewiseComparator } from './Comparator'
import BloomFilter from './BloomFilter'
import { Comparator } from './Comparator'
import Slice from './Slice'

export type Encodings = 'string' | 'buffer' | 'json'

export interface EncodingOptions {
  keyEncoding?: Encodings
  valueEncoding?: Encodings
  prefix?: string
}

export interface FilterPolicy {
  name(): string
  keyMayMatch(key: Slice, filter: Slice): boolean
}

export class Options {
  // Comparator used to define the order of keys in the table.
  // Default: a comparator that uses lexicographic byte-wise ordering
  //
  // REQUIRES: The client must ensure that the comparator supplied
  // here has the same name and orders keys *exactly* the same as the
  // comparator provided to previous open calls on the same DB.
  comparator: Comparator = new BytewiseComparator()
  maxFileSize: number = 1000
  blockSize: number = 2 << 11
  blockRestartInterval: number = 16
  filterPolicy: FilterPolicy = new BloomFilter()
}
