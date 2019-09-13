/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow

import VersionSet from './VersionSet'
import Version from './Version'
import VersionEdit from './VersionEdit'
import { kNumLevels, InternalKey } from './Format'

class BySmallestKey {
  internalComparator:any

  operator () {

  }
}

// 能自动排序的set（根据internalkey comparator排序，如果small key相同，则比较file number
class FileSet {
  compare: BySmallestKey
}

export default class VersionBuilder {
  constructor (versionSet: VersionSet, base:Version) {
    this._versionSet = versionSet
    this._base = base
    base.Ref()
    const cmp = new BySmallestKey()
    cmp.internal_comparator = versionSet.internalComparator
    for (let level = 0; level < kNumLevels; level++) {
      this._levels[level].addedFiles = new FileSet(cmp)
    }
  }

  _versionSet:VersionSet
  _base:Version
  _addedFiles: FileSet

  apply (edit:VersionEdit) {
    // Update compaction pointers
    // compactPointers: type = <int, InternalKey>
    for (let i = 0; i < edit.compactPointers.length; i++) {
      const level = edit.compactPointers[i].first
      this.versionSet.compactPointers[level] = edit.compactPointers[i].second
    }
    // traverse deleted_files_，删除文件

    // traverse new_files_
  }

  saveTo (ver:Version) {

  }
}
