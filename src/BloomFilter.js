/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import varint from 'varint'
import { Buffer } from 'buffer'
import BitBuffer from './BitBuffer'
import MurmurHash3 from './MurmurHash3'

/**
 * 关键是hash几次。hash次数 = 位图数位 / 元素个数 x ln2(约等于0.69)
 * 其中元素个数和ln2是可确定的，位图数位理论上越大越好，将作为配置项
 */
export default class BloomFilter {
  constructor (buffer:Buffer) {
    this._buffer = buffer
    this._bitBuffer = new BitBuffer(buffer.slice(0, buffer.length - 1))
  }

  putKeys (keys:string[]) {

  }

  keyMayMatch (key:string):boolean {
    const k = this.kNumber
    const bits = this._bitBuffer.bits
    if (k > 30) return true
    let h = MurmurHash3(key)
    let delta = (h >> 17) | (h << 15)
    for (let j = 0; j < k; j++) {
      const bitpos = h % bits
      if (!this._bitBuffer.get(bitpos)) return false
      h += delta
    }
    return true
  }

  get kNumber ():number {
    return varint.decode(this._buffer.slice(this._offset, this._offset + this._size - 1))
  }
}
