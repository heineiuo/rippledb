/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow

import assert from 'assert'
import { FileMetaData, FileSet } from './VersionFormat'
import VersionSet from './VersionSet'

export default class Version {
  next:Version|null
  prev:Version|null
  refs:number
  fileTocompact:FileMetaData|null
  fileTocompactLevel:number
  compactionScore:number
  compactionLevel:number
  files: {
    [level:number]: FileSet
  }

  constructor (versionSet:VersionSet) {
    this.next = this
    this.prev = this
    this.refs = 0
    this.fileTocompact = null
    this.fileTocompactLevel = -1
    this.compactionScore = -1
    this.compactionLevel = -1
  }

  ref () {
    this.refs++
  }

  unref () {
    assert(this.refs >= 1)
    this.refs--
    if (this.refs === 0) {
      // delete
    }
  }
}
