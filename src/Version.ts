/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import Slice from './Slice'
import { FileMetaData, BySmallestKey, GetStats } from './VersionFormat'
import VersionSet from './VersionSet'
import {
  Config,
  InternalKey,
  SequenceNumber,
  ValueType,
  InternalKeyComparator,
  parseInternalKey,
  ParsedInternalKey,
  kValueTypeForSeek,
  LookupKey,
} from './Format'
import Compaction from './Compaction'
import Status from './Status'
import { Comparator } from './Comparator'
import { ReadOptions } from './Options'

enum SaverState {
  kNotFound,
  kFound,
  kDeleted,
  kCorrupt,
}

class Saver {
  state!: SaverState
  ucmp!: Comparator
  userKey!: Slice
  value!: Buffer
}

class State {
  s!: Status
  vset!: VersionSet
  options!: ReadOptions
  ikey!: Slice
  lastFileRead!: FileMetaData
  lastFileReadLevel!: number
  stats!: GetStats
  found!: boolean
  saver!: Saver
  async match(arg: void, level: number, f: FileMetaData): Promise<boolean> {
    if (!this.stats.seekFile && !!this.lastFileRead) {
      // We have had more than one seek for this read.  Charge the 1st file.
      this.stats.seekFile = this.lastFileRead
      this.stats.seekFileLevel = this.lastFileReadLevel
    }

    this.lastFileRead = f
    this.lastFileReadLevel = level

    this.s = await this.vset.tableCache.get(
      this.options,
      f.number,
      f.fileSize,
      this.ikey,
      this.saver,
      Version.saveValue
    )

    switch (this.saver.state) {
      case SaverState.kNotFound:
        return true // Keep searching in other files
      case SaverState.kFound:
        this.found = true
        return false
      case SaverState.kDeleted:
        return false
      case SaverState.kCorrupt:
        this.s = Status.createCorruption(
          `corrupted key for ${this.saver.userKey.toString()}`
        )
        this.found = true
        return false
    }
    return false
  }
}

export default class Version {
  static saveValue(arg: void, ikey: Slice, v: Slice) {
    const saver = new Saver()
    const parsedKey = new ParsedInternalKey()
    if (!parseInternalKey(ikey, parsedKey)) {
      saver.state = SaverState.kCorrupt
    } else {
      if (saver.ucmp.compare(parsedKey.userKey, saver.userKey) == 0) {
        saver.state =
          parsedKey.valueType == ValueType.kTypeValue
            ? SaverState.kFound
            : SaverState.kDeleted
        if (saver.state == SaverState.kFound) {
          saver.value = Buffer.concat([saver.value, v.buffer])
        }
      }
    }
  }

  static afterFile(ucmp: Comparator, userKey: Slice, f: FileMetaData): boolean {
    return !!userKey && ucmp.compare(userKey, f.largest.userKey) > 0
  }
  static beforeFile(
    ucmp: Comparator,
    userKey: Slice,
    f: FileMetaData
  ): boolean {
    return !!userKey && ucmp.compare(userKey, f.smallest.userKey) < 0
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
      // TODO delete
    }
  }

  public async get(lkey: LookupKey, stats: GetStats): Promise<Status> {
    delete stats.seekFile
    stats.seekFileLevel = -1

    let state = new State()
    state.found = false
    state.stats = stats
    state.lastFileReadLevel = -1
    state.options = {} as ReadOptions
    state.ikey = lkey.internalKey

    let status = await this.forEachOverlapping(
      lkey.userKey,
      lkey.internalKey,
      state,
      function match(arg, level, f) {
        return true
      }
    )

    return status
  }

  // Call match() for every file that overlaps userKey in
  // order from newest to oldest.  If an invocation of func returns
  // false, makes no more calls.
  //
  // REQUIRES: user portion of internal_key == user_key.
  async forEachOverlapping(
    userKey: Slice,
    internalKey: Slice,
    arg: any,
    match: (arg: any, level: number, f: FileMetaData) => boolean
  ): Promise<Status> {
    return new Status()
  }

  someFileOverlapsRange(
    icmp: InternalKeyComparator,
    disjointSortedFile: boolean,
    files: FileMetaData[],
    smallestUserKey: Slice,
    largestUserKey: Slice
  ): boolean {
    const ucmp = icmp.userComparator
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
      index = this.findFile(icmp, files, smallkey)
    }

    if (index >= files.length) {
      return false
    }

    return !Version.beforeFile(ucmp, largestUserKey, files[index])
  }

  // binary search
  findFile(
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
    return this.someFileOverlapsRange(
      this.versionSet.internalKeyComparator,
      level > 0,
      this.files[level],
      smallestUserKey,
      largestUserKey
    )
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

    const userComparator = this.versionSet.internalKeyComparator.userComparator
    for (let i = 0; i < this.files[level].length; ) {
      const fileMetaData = this.files[level][i++]
      const fileStart = fileMetaData.smallest.userKey
      const fileLimit = fileMetaData.largest.userKey
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

  public pickLevelForMemTableOutput(
    minUserKey: Slice,
    maxUserKey: Slice
  ): number {
    let level = 0
    if (!this.overlapInLevel(0, minUserKey, maxUserKey)) {
      // Push to next level if there is no overlap in next level,
      // and the #bytes overlapping in the level after that are limited.
      const start = new InternalKey(
        minUserKey,
        InternalKey.kMaxSequenceNumber,
        kValueTypeForSeek
      )
      const limit = new InternalKey(
        maxUserKey,
        new SequenceNumber(0),
        ValueType.kTypeValue
      )
      const overlaps = [] as FileMetaData[]
      while (level < Config.kMaxMemCompactLevel) {
        if (this.overlapInLevel(level + 1, minUserKey, maxUserKey)) {
          break
        }
        if (level + 2 < Config.kNumLevels) {
          // Check that file does not overlap too many grandparent bytes.
          this.getOverlappingInputs(level + 2, start, limit, overlaps)
          const sum = Compaction.totalFileSize(overlaps)
          if (
            sum >
            Compaction.maxGrandParentOverlapBytes(this.versionSet._options)
          ) {
            break
          }
        }
        level++
      }
    }
    return level
  }
}
