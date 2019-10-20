/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import Slice from './Slice'

export interface Comparator {
  // Three-way comparison.  Returns value:
  //   < 0 iff "a" < "b",
  //   == 0 iff "a" == "b",
  //   > 0 iff "a" > "b"
  compare(a: Slice, b: Slice): number

  // The name of the comparator.  Used to check for comparator
  // mismatches (i.e., a DB created with one comparator is
  // accessed using a different comparator.
  //
  // The client of this package should switch to a new name whenever
  // the comparator implementation changes in a way that will cause
  // the relative ordering of any two keys to change.
  //
  // Names starting with "leveldb." are reserved and should not be used
  // by any clients of this package.
  getName(): string

  // Advanced functions: these are used to reduce the space requirements
  // for internal data structures like index blocks.

  // If *start < limit, changes *start to a short string in [start,limit).
  // Simple comparator implementations may return with *start unchanged,
  // i.e., an implementation of this method that does nothing is correct.
  findShortestSeparator(start: Slice, limit: Slice): void

  // Changes *key to a short string >= *key.
  // Simple comparator implementations may return with *key unchanged,
  // i.e., an implementation of this method that does nothing is correct.
  findShortSuccessor(key: Slice): void
}

export class BytewiseComparator implements Comparator {
  getName(): string {
    return 'leveldb.BytewiseComparator'
  }

  compare(a: Slice, b: Slice): number {
    return a.compare(b)
  }

  findShortestSeparator(start: Slice, limit: Slice): void {
    // Find length of common prefix
    const minLength = Math.min(start.length, limit.size)
    let diffIndex = 0
    while (
      diffIndex < minLength &&
      start.buffer[diffIndex] == limit.buffer[diffIndex]
    ) {
      diffIndex++
    }

    if (diffIndex >= minLength) {
      // Do not shorten if one string is a prefix of the other
    } else {
      const diffByte = start.buffer[diffIndex]
      if (diffByte < 0xff && diffByte + 1 < limit.buffer[diffIndex]) {
        start.buffer[diffIndex]++
        start.buffer = start.buffer.slice(0, diffIndex + 1)
        assert(this.compare(start, limit) < 0)
      }
    }
  }

  findShortSuccessor(key: Slice): void {
    // Find first character that can be incremented
    const n = key.length
    for (let i = 0; i < n; i++) {
      const byte = key.buffer[i]
      if (byte != 0xff) {
        key.buffer[i] = byte + 1
        key.buffer = key.buffer.slice(0, i + 1)
        return
      }
    }
    // *key is a run of 0xffs.  Leave it alone.
  }
}
