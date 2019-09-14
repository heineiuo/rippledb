/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow

import InternalKey from './InternalKey'

export type FileMetaDataLeveldb = {
  fileNum:number,
  fileSize:number,
  smallestKey:InternalKey,
  largestKey:InternalKey
}

export default class FileMetaData {
  // reference count
  refs: number
  // if seeks > allowedSeeks, trigger compaction
  allowedSeeks: number
  number: number
  fileSize: number
  smallest: InternalKey
  largest: InternalKey

  set refs (value:number) {
    this._refs = value
  }

  get refs () {
    return this._refs
  }
}
