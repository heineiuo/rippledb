/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow

import fs from 'fs'
import Version from './Version'
import { getCurrentFilename, getManifestFilename } from './Filename'
import { InternalKeyComparator } from './Format'
import VersionBuilder from './VersionBuilder'
import VersionEditRecord from './VersionEditRecord'
import LogReader from './LogReader'

export default class VersionSet {
  constructor (dbpath, options, memtable, internalKeyComparator) {
    this._dbpath = dbpath
    this._options = options
    this._memtable = memtable
    this._internalKeyComparator = internalKeyComparator
    this.appendVersion(new Version())
    this.compactPointers = []
  }

  compactPointers: any[]
  _manifestFileNumber: number
  _current: Version
  internalComparator: InternalKeyComparator

  get current ():Version {
    return this._current
  }

  async recover () {
    // 读取current， 校验是否是\n结尾
    const current = await fs.promises.readFile(getCurrentFilename(this._dbpath), 'utf8')
    if (!current || current[current.length - 1] !== '\n') {
      throw new Error('Invalid format of CURRENT file.')
    }
    const builder = new VersionBuilder(this, this._current)

    const reader = new LogReader(getManifestFilename(this._dbpath, current.substr(0, current.length - 1)), VersionEditRecord)
    for await (let edit of reader.iterator()) {
      builder.apply(edit)
    }

    // 根据current读取dscfile(description file), 即manifest文件
    // 读取record，apply到versionSet(apply方法)
    // 更新log number和prev log number（可省略，因为prevlognumber其实被废弃了）
    // 更新next file
    // 更新last sequence
    // 通过version builder 创建一个新的version

    // 将apply的结果添加到version(finalize)
    // 将version添加到version set(append version)
    // 更新manifest_file_number_， next_file_number_， last_sequence_， log_number_， prev_log_number_
    // 检查是否需要创建新的manifest（ reuseManifest ）
  }

  del (version:Version) {

  }

  add (version:Version) {

  }

  finalize () {
    // traverse levels(0-6),
    // 计算score，0级用文件数量 / 8（设置到最大允许值）， 其他用文件体积 / 最大允许体积10^level
    // 如果score > best_score（best_score初始值-1）, 更新best_score和best_level
    // traverse结束更新version的best_score和best_level
  }

  logAndApply () {

  }

  /**
   * 主要目的是更新this._current
   */
  appendVersion (ver: Version):void {
    this._current = ver
  }

  reuseManifest () {
    return false
  }
}
