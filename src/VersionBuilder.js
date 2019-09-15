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
import { Config } from './Format'
import { FileMetaData, BySmallestKey, FileSet } from './VersionFormat'

export default class VersionBuilder {
  _versionSet:VersionSet
  _base:Version
  _levels: {
    // TODO: JavaScript native Set cannot compare object value, should be rewritten
    addedFiles: FileSet,
    deletedFiles: Set<number>
  }[]

  constructor (versionSet: VersionSet, base:Version) {
    this._versionSet = versionSet
    this._base = base
    this._levels = Array.from({ length: Config.kNumLevels }, (v, k) => ({}))
    base.ref()
    const cmp = new BySmallestKey()
    cmp.internalComparator = versionSet.internalComparator
    for (let level = 0; level < Config.kNumLevels; level++) {
      this._levels[level].addedFiles = new FileSet(cmp)
    }
  }

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

    // traverse new files
    for (let file of edit.newFiles) {
      const { level, fileMetaData } = file
      fileMetaData.refs = 1
      fileMetaData.allowedSeeks = file.fileMetaData.fileSize / 16384 // 16kb, 经验值
      if (fileMetaData.allowedSeeks < 100) fileMetaData.allowedSeeks = 100
      this._levels[level].deletedFiles.delete(fileMetaData.number)
      this._levels[level].addedFiles.add(fileMetaData)
    }
  }

  saveTo (ver:Version) {
    const cmp = new BySmallestKey()
    cmp.internalComparator = this._versionSet.internalComparator
    // traverse every level and put added files in right position
    for (let level = 0; level < Config.kNumLevels; level++) {
      if (!this._base.files[level]) continue
      const baseFileIterator = this._base.files[level].iterator()
      const addedFileIterator = this._levels[level].addedFiles.iterator()
      let baseFile = baseFileIterator.next()
      let addedFile = addedFileIterator.next()
      if ((!baseFile.done && !addedFile.done && cmp.operator(baseFile.value, addedFile.value)) ||
          (!baseFile.done && addedFile.done)
      ) {
        this.maybeAddFile(ver, level, baseFile.value)
        baseFile = baseFileIterator.next()
      } else if (!addedFile.done) {
        this.maybeAddFile(ver, level, addedFile.value)
        addedFile = addedFileIterator.next()
      }

      // Make sure there is no overlap in levels > 0
      if (level > 0) {

      }
    }
  }

  maybeAddFile (ver:Version, level:number, file:FileMetaData) {
    if (this._levels[level].deletedFiles.has(file.number)) {
      // File is deleted: do nothing
    } else {
      if (!ver.files[level]) {
        ver.files[level] = new FileSet()
      }
      file.refs++
      ver.files[level].add(file)
    }
  }
}
