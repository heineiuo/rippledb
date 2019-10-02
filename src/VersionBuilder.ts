/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import VersionSet from './VersionSet'
import Version from './Version'
import VersionEdit from './VersionEdit'
import { Config } from './Format'
import { FileMetaData, BySmallestKey, FileSet } from './VersionFormat'
import assert from 'assert'

export default class VersionBuilder {
  _versionSet: VersionSet
  _base: Version
  _levels: {
    // TODO: JavaScript native Set cannot compare object value, should be rewritten
    addedFiles: FileSet
    deletedFiles: Set<number>
  }[]

  cmp: BySmallestKey

  constructor(versionSet: VersionSet, base: Version) {
    this._versionSet = versionSet
    this._base = base
    this._levels = Array.from({ length: Config.kNumLevels }, (v, k) => ({
      addedFiles: new FileSet(this.cmp),
      deletedFiles: new Set(),
    }))
    base.ref()
    const cmp = new BySmallestKey(versionSet.internalKeyComparator)
    this.cmp = cmp
    for (let level = 0; level < Config.kNumLevels; level++) {
      this._levels[level].addedFiles = new FileSet(cmp)
    }
  }

  // Apply all of the edits in *edit to the current state.
  apply(edit: VersionEdit) {
    // Update compaction pointers
    // compactPointers: type = <int, InternalKey>
    for (let i = 0; i < edit.compactPointers.length; i++) {
      const level = edit.compactPointers[i].level
      this._versionSet.compactPointers[level] =
        edit.compactPointers[i].internalKey
    }
    // traverse deleted_files_ put file to each level's deleted_files
    for (let i = 0; i < edit.deletedFiles.length; i++) {
      const { level, fileNum } = edit.deletedFiles[i]
      this._levels[level].deletedFiles.add(fileNum)
    }

    // traverse new files
    for (let file of edit.newFiles) {
      const { level, fileMetaData } = file
      fileMetaData.refs = 1
      fileMetaData.allowedSeeks = file.fileMetaData.fileSize / 16384 // 16kb, experience value
      if (fileMetaData.allowedSeeks < 100) fileMetaData.allowedSeeks = 100
      this._levels[level].deletedFiles.delete(fileMetaData.number)
      this._levels[level].addedFiles.add(fileMetaData)
    }
  }

  saveTo(ver: Version) {
    const cmp = new BySmallestKey(this._versionSet.internalKeyComparator)
    // traverse every level and put added files in right position [ baseFiles_A, addedFiles, baseFiels_B ) ]
    for (let level = 0; level < Config.kNumLevels; level++) {
      if (!this._base.files[level]) continue
      // addedFiles is sorted
      const addedFileIterator = this._levels[level].addedFiles.iterator()
      let addedFile = addedFileIterator.next()
      for (let i = 0; i < this._base.files[level].length; ) {
        let baseFile = this._base.files[level][i++]
        if (!addedFile.done) {
          if (cmp.operator(baseFile, addedFile.value)) {
            this.maybeAddFile(ver, level, baseFile)
            i--
          } else {
            this.maybeAddFile(ver, level, addedFile.value)
            addedFile = addedFileIterator.next()
          }
        } else {
          this.maybeAddFile(ver, level, baseFile)
        }
      }
    }
  }

  maybeAddFile(ver: Version, level: number, file: FileMetaData) {
    if (this._levels[level].deletedFiles.has(file.number)) {
      // File is deleted: do nothing
    } else {
      const files = ver.files[level]
      if (level > 0 && files.length > 0) {
        assert(
          this._versionSet.internalKeyComparator.compare(
            files[files.length - 1].largest,
            file.smallest
          ) < 0
        )
      }
      file.refs++
      ver.files[level].push(file)
    }
  }
}
