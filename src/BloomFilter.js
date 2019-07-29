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
  constructor (buffer:Buffer, bitsPerKey:number = 10) {
    this._buffer = buffer
    this._bitBuffer = new BitBuffer(buffer.slice(0, buffer.length - 1))
    this._bitsPerKey = bitsPerKey
    this._bestHashTimes = bitsPerKey * 0.69
  }

  get buffer ():Buffer {
    return this._buffer
  }

  get bestHashTimes ():number {
    return this._bestHashTimes
  }

  get kNumber ():number {
    return varint.decode(this._buffer.slice(this._offset, this._offset + this._size - 1))
  }

  putKeys (keys:string[], n:number) {
    const bits = n * this._bitsPerKey
    this._bitBuffer.resizeBits(bits)
    const bestHashTimes = this.bestHashTimes
    for (let i = 0; i < n; i++) {
      let h = MurmurHash3(keys[i])
      let delta = (h >> 17) | (h << 15)
      for (let j = 0; j < bestHashTimes; j++) {
        const bitPosition = h % bits
        this._bitBuffer.set(bitPosition, true)
        h += delta
      }
    }
    this._buffer = Buffer.concat(
      this._bitBuffer.buffer,
      this._buffer.slice(this._offset, this._offset + this._size - 1)
    )
    this._size = this._buffer.length
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
}
