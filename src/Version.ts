/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import Slice from './Slice'
import {
  InternalKey,
  Comparator,
  InternalKeyComparator,
  FileMetaData,
  kValueTypeForSeek,
  BySmallestKey,
} from './VersionFormat'
import VersionSet from './VersionSet'
import { Config } from './Format'

export default class Version {
  static afterFile(ucmp: Comparator, userKey: Slice, f: FileMetaData): boolean {
    return !!userKey && ucmp.compare(userKey, f.largest.extractUserKey()) > 0
  }
  static beforeFile(
    ucmp: Comparator,
    userKey: Slice,
    f: FileMetaData
  ): boolean {
    return !!userKey && ucmp.compare(userKey, f.smallest.extractUserKey()) < 0
  }

  versionSet: VersionSet
  next: Version
  prev: Version
  refs: number

  // Next file to compact based on seek stats.
  fileToCompact!: FileMetaData
  fileToCompactLevel: number

  compactionScore: number
  compactionLevel: number
  files: FileMetaData[][]

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
    this.files = Array.from({ length: Config.kNumLevels }, () => [])
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

  someFileOverlapsRange(
    icmp: InternalKeyComparator,
    disjointSortedFile: boolean,
    files: FileMetaData[],
    smallestUserKey: Slice,
    largestUserKey: Slice
  ): boolean {
    const ucmp = icmp.getUserComparator()
    if (!disjointSortedFile) {
      // Need to check against all files
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        if (
          Version.afterFile(ucmp, smallestUserKey, f) ||
          Version.beforeFile(ucmp, largestUserKey, f)
        ) {
          // No overlap
        } else {
          return true
        }
      }
      return false
    }
    // Binary search over file list
    let index = 0
    if (!!smallestUserKey) {
      // Find the earliest possible internal key for smallest_user_key
      const smallkey = new InternalKey(
        smallestUserKey,
        InternalKey.kMaxSequenceNumber,
        kValueTypeForSeek
      )
      index = this.fildFile(icmp, files, smallkey)
    }

    if (index >= files.length) {
      return false
    }

    return !Version.beforeFile(ucmp, largestUserKey, files[index])
  }

  // binary search
  fildFile(
    icmp: InternalKeyComparator,
    files: FileMetaData[],
    key: Slice
  ): number {
    let left = 0 //  uint32_t
    let right = files.length // uint32_t
    while (left < right) {
      let mid = (left + right) / 2
      let file = files[mid]
      if (icmp.compare(file.largest, key) < 0) {
        left = mid + 1
      } else {
        right = mid
      }
    }
    return right
  }

  overlapInLevel(
    level: number,
    smallestUserKey: Slice,
    largestUserKey: Slice
  ): boolean {
    return true
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
    for (let i = 0; i < this.files[level].length; ) {
      const fileMetaData = this.files[level][i++]
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
