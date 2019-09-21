/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileMetaData } from './VersionFormat'
import Version from './Version'
import VersionEdit from './VersionEdit'

export default class Compaction {
  level: number
  inputVersion!: Version
  grandparents!: FileMetaData[]
  edit!: VersionEdit

  // Each compaction reads inputs from "level_" and "level_+1"
  inputs!: [FileMetaData[], FileMetaData[]]

  constructor(options: any, level: number) {
    this.level = level
    this.inputs = [[], []]
  }

  ssTrivialMove(): boolean {
    return false
  }
}
