/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert, { strictEqual } from 'assert'
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
  saver: Saver = new Saver()

  static async match(
    state: State,
    level: number,
    f: FileMetaData
  ): Promise<boolean> {
    if (!state.stats.seekFile && !!state.lastFileRead) {
      // We have had more than one seek for this read.  Charge the 1st file.
      state.stats.seekFile = state.lastFileRead
      state.stats.seekFileLevel = state.lastFileReadLevel
    }

    state.lastFileRead = f
    state.lastFileReadLevel = level

    state.s = await state.vset.tableCache.get(
      state.options,
      f.number,
      f.fileSize,
      state.ikey,
      state.saver,
      Version.saveValue // handleResult
    )

    if (!(await state.s.ok())) return false

    // console.log(`before switch state.saver.state=${state.saver.state}`)
    switch (state.saver.state) {
      case SaverState.kNotFound:
        return true // Keep searching in other files
      case SaverState.kFound:
        state.found = true
        return false
      case SaverState.kDeleted:
        return false
      case SaverState.kCorrupt:
        state.s = Status.createCorruption(
          `corrupted key for ${state.saver.userKey.toString()}`
        )
        state.found = true
        return false
    }
    return false
  }
}

export default class Version {
  static saveValue(saver: Saver, ikey: Slice, v: Slice) {
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
          saver.value = Buffer.concat([v.buffer])
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

  public files: FileMetaData[][]

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

  public ref() {
    this.refs++
  }

  public unref() {
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
    state.vset = this.versionSet

    state.saver.state = SaverState.kNotFound
    state.saver.ucmp = this.versionSet.internalKeyComparator.userComparator
    state.saver.userKey = lkey.userKey

    await this.forEachOverlapping(
      lkey.userKey,
      lkey.internalKey,
      state,
      State.match
    )

    // console.log(`after version gett, state is `, state)

    if (!state.found) {
      return Status.createNotFound()
    }

    return new Status(Promise.resolve(state.saver.value))
  }

  // Call match() for every file that overlaps userKey in
  // order from newest to oldest.  If an invocation of func returns
  // false, makes no more calls.
  //
  // REQUIRES: user portion of internal_key == user_key.
  public async forEachOverlapping(
    userKey: Slice,
    internalKey: Slice,
    arg: any,
    match: (arg: any, level: number, f: FileMetaData) => Promise<boolean>
  ): Promise<void> {
    const ucmp = this.versionSet.internalKeyComparator.userComparator
    // Search level-0 in order from newest to oldest.
    const tmp = [] as FileMetaData[]
    // console.log(`forEachOverlapping current.files=`, this.files)

    // console.log(this.files)

    for (let i = 0; i < this.files[0].length; i++) {
      const f = this.files[0][i]

      if (
        ucmp.compare(userKey, f.smallest.userKey) >= 0 &&
        ucmp.compare(userKey, f.largest.userKey) <= 0
      ) {
        tmp.push(f)
      }
    }
    if (tmp.length > 0) {
      // NewestFirst
      tmp.sort((a, b) => (a.number > b.number ? -1 : 1))

      for (let i = 0; i < tmp.length; i++) {
        if (!(await match(arg, 0, tmp[i]))) {
          return
        }
      }
    }

    // Search other levels.
    for (let level = 0; level < Config.kNumLevels; level++) {
      const numFiles = this.files[level].length
      if (numFiles === 0) continue
      const index = this.findFile(
        this.versionSet.internalKeyComparator,
        this.files[level],
        internalKey
      )
      if (index < numFiles) {
        const f = this.files[level][index]
        if (ucmp.compare(userKey, f.smallest.userKey) < 0) {
          // All of "f" is past any data for user_key
        } else {
          if (!(await match(arg, level, f))) {
            return
          }
        }
      }
    }
  }

  private someFileOverlapsRange(
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
  private findFile(
    icmp: InternalKeyComparator,
    files: FileMetaData[],
    key: Slice
  ): number {
    let left = 0 //  uint32_t
    let right = files.length // uint32_t
    while (left < right) {
      let mid = Math.floor((left + right) / 2)
      let file = files[mid]
      // console.log(`mid=${mid}`, `file=`, file)
      if (icmp.compare(file.largest, key) < 0) {
        left = mid + 1
      } else {
        right = mid
      }
    }
    return right
  }

  public overlapInLevel(
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
  public getOverlappingInputs(
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
