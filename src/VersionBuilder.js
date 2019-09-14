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
import { kNumLevels } from './Format'
import { FileMetaData, BySmallestKey, FileSet } from './VersionFormat'

export default class VersionBuilder {
  constructor (versionSet: VersionSet, base:Version) {
    this._versionSet = versionSet
    this._base = base
    base.ref()
    const cmp = new BySmallestKey()
    cmp.internalComparator = versionSet.internalComparator
    for (let level = 0; level < kNumLevels; level++) {
      this._levels[level].addedFiles = new FileSet(cmp)
    }
  }

  _versionSet:VersionSet
  _base:Version
  _levels: {
    // TODO: JavaScript native Set cannot compare object value, should be rewritten
    addedFiles: FileSet,
    deletedFiles: Set<number>
  }[]

  apply (edit:VersionEdit) {
    // Update compaction pointers
    // compactPointers: type = <int, InternalKey>
    for (let i = 0; i < edit.compactPointers.length; i++) {
      const level = edit.compactPointers[i].level
      this._versionSet.compactPointers[level] = edit.compactPointers[i].internalKey
    }
    // traverse deleted_files_ 记录可删除文件到各level对应的deleted_files
    for (let i = 0; i < edit.deletedFiles.length; i++) {
      const { level, number } = edit.deletedFiles[i]
      this._levels[level].deletedFiles.add(number)
    }

    // traverse new_files_
    for (let file of edit.newFiles) {
      const { level } = file
      const fileMetaData = new FileMetaData(file)
      fileMetaData.refs = 1
      fileMetaData.allowedSeeks = file.fileMetaData.fileSize / 16384
      if (fileMetaData.allowedSeeks < 100) fileMetaData.allowedSeeks = 100
      this._levels[level].deletedFiles.delete(fileMetaData.number)
      this._levels[level].addedFiles.add(fileMetaData)
    }
  }

  saveTo (ver:Version) {
    const cmp = new BySmallestKey()
    cmp.internalComparator = this._versionSet.internalComparator
  }
}
