/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs'
import { FileMetaData, InternalKey } from './VersionFormat'
import Version from './Version'
import VersionEdit from './VersionEdit'
import { Options } from './Options'
import SequenceNumber from './SequenceNumber'

export default class Compaction {
  static targetFileSize(options: Options) {
    return options.maxFileSize
  }

  static maxGrandParentOverlapBytes(options: Options) {
    return 10 * Compaction.targetFileSize(options)
  }

  static totalFileSize(files: FileMetaData[]) {
    let sum = 0
    for (let file of files) {
      sum += file.fileSize
    }
    return sum
  }

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

  numInputFiles(which: 0 | 1): number {
    return this.inputs[which].length
  }

  isTrivialMode(): boolean {
    const versionSet = this.inputVersion.versionSet
    // Avoid a move if there is lots of overlapping grandparent data.
    // Otherwise, the move could create a parent file that will require
    // a very expensive merge later on.
    return (
      this.numInputFiles(0) === 1 &&
      this.numInputFiles(1) === 0 &&
      Compaction.totalFileSize(this.grandparents) <=
        Compaction.maxGrandParentOverlapBytes(versionSet._options)
    )
  }

  releaseInputs() {
    if (!!this.inputVersion) {
      this.inputVersion.unref()
      delete this.inputVersion
    }
  }
}

export interface CompactionStateOutput {
  number: number
  fileSize: number
  smallest: InternalKey
  largest: InternalKey
}

export class CompactionState {
  outputs!: CompactionStateOutput[]
  smallestSnapshot: number
  compaction: Compaction
  outfile!: fs.promises.FileHandle
  builder!: fs.promises.FileHandle
  totalBytes: number

  constructor(c: Compaction) {
    this.compaction = c
    this.smallestSnapshot = 0
    this.totalBytes = 0
  }

  currentOutput(): CompactionStateOutput {
    return this.outputs[this.outputs.length - 1]
  }
}
