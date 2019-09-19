/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import { FileMetaData, FileSet, BySmallestKey } from './VersionFormat'
import VersionSet from './VersionSet'
import { Config } from './Format'

export default class Version {
  next: Version
  prev: Version
  refs: number

  // Next file to compact based on seek stats.
  fileToCompact: FileMetaData | null
  fileToCompactLevel: number

  compactionScore: number
  compactionLevel: number
  files: FileSet[]

  constructor(versionSet: VersionSet) {
    this.next = this
    this.prev = this
    this.refs = 0
    this.fileToCompact = null
    this.fileToCompactLevel = -1
    this.compactionScore = -1
    this.compactionLevel = -1
    const cmp = new BySmallestKey(versionSet.internalKeyComparator)
    this.files = Array.from(
      { length: Config.kNumLevels },
      () => new FileSet(cmp)
    )
  }

  ref() {
    this.refs++
  }

  unref() {
    assert(this.refs >= 1)
    this.refs--
    if (this.refs === 0) {
      // delete
    }
  }
}
