/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import varint from 'varint'
import { Buffer } from 'buffer'
import MurmurHash3 from './MurmurHash3'

/**
 * 关键是hash几次。hash次数 = 位图数位 / 元素个数 x ln2(约等于0.69)
 * 其中元素个数和ln2是可确定的，位图数位理论上越大越好，将作为配置项
 */
export default class BloomFilter {
  constructor (buffer:Buffer, offset?:number, size?:number) {
    this._buffer = buffer
    this._offset = offset || 0
    this._size = size
  }

  keyMayMatch (key):boolean {
    const k = this.kNumber
    if (k > 30) return true
  }

  get kNumber ():number {
    return varint.decode(this._buffer.slice(this._offset, this._offset + this._size - 1))
  }
}
