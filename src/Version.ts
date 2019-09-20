/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import Slice from './Slice'
import { InternalKey } from './VersionFormat'
import { FileMetaData, FileSet, BySmallestKey } from './VersionFormat'
import VersionSet from './VersionSet'
import { Config } from './Format'

export default class Version {
  versionSet: VersionSet
  next: Version
  prev: Version
  refs: number

  // Next file to compact based on seek stats.
  fileToCompact!: FileMetaData
  fileToCompactLevel: number

  compactionScore: number
  compactionLevel: number
  files: FileSet[]

  constructor(versionSet: VersionSet) {
    this.versionSet = versionSet
    this.next = this
    this.prev = this
    this.refs = 0
    // this.fileToCompact = null
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

  // Store in "*inputs" all files in "level" that overlap [begin,end]
  getOverlappingInputs(
    level: number,
    begin: InternalKey,
    end: InternalKey,
    inputs: FileMetaData[]
  ): void {
    assert(level >= 0)
    assert(level < Config.kNumLevels)
    // todo clear inputs
    inputs = []
    let userBegin = begin ? begin : new Slice()
    let userEnd = end ? end : new Slice()

    const userComparator = this.versionSet.internalKeyComparator.getUserComparator()
    for (let i = 0; i < this.files[level].size(); ) {
      const fileMetaData = this.files[level].data[i++]
      const fileStart = fileMetaData.smallest.extractUserKey()
      const fileLimit = fileMetaData.largest.extractUserKey()
      if (!!begin && userComparator.compare(fileLimit, userBegin) < 0) {
        // "f" is completely before specified range; skip it
      } else if (!!end && userComparator.compare(fileStart, userEnd) > 0) {
        // "f" is completely after specified range; skip it
      } else {
        inputs.push(fileMetaData)
        if (level === 0) {
          if (!!begin && userComparator.compare(fileStart, userBegin) < 0) {
            userBegin = fileStart
            inputs = []
            i = 0
          } else if (!!end && userComparator.compare(fileLimit, userEnd) > 0) {
            userEnd = fileLimit
            inputs = []
            i = 0
          }
        }
      }
    }
  }
}
