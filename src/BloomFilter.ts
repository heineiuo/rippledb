/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

import varint from 'varint'
import { Buffer } from 'buffer'
import BitBuffer from './BitBuffer'
import BloomHash from './MurmurHash'
import Slice from './Slice'

/**
 * 关键是hash几次。hash次数 = 位图数位 / 元素个数 x ln2(约等于0.69)
 * 其中元素个数和ln2是可确定的，位图数位理论上越大越好，将作为配置项
 */
export default class BloomFilter {
  constructor(buffer: Buffer, bitsPerKey: number = 10) {
    this._buffer = buffer
    this._offset = 0
    this._bitsPerKey = bitsPerKey
    const k = Math.round(bitsPerKey * 0.69)

    if (!buffer || buffer.length === 0) {
      this._buffer = Buffer.from(varint.encode(k))
      this._bitBuffer = new BitBuffer(Buffer.alloc(Math.ceil(k / 8)))
      this._kNumber = k
    } else {
      this._bitBuffer = new BitBuffer(buffer.slice(0, buffer.length - 1))
      this._kNumber = varint.decode(this._buffer.slice(this._buffer.length - 1))
      if (this._kNumber !== k) {
        this._kNumber = k
        this._buffer = Buffer.concat([
          this._buffer.slice(0, this._buffer.length - 1),
          Buffer.from(varint.encode(k)),
        ])
        this._bitBuffer.resizeBits(k)
      }
    }
    this._size = this._buffer.length
  }

  _buffer: Buffer
  _offset: number
  _size: number
  _kNumber: number
  _bitBuffer: BitBuffer
  _bitsPerKey: number

  get bitsPerKey(): number {
    return this._bitsPerKey
  }

  get buffer(): Buffer {
    return this._buffer
  }

  get size(): number {
    return this._size
  }

  get kNumber(): number {
    return this._kNumber
  }

  putKeys(keys: string[], n: number): void {
    let bits = this.bitsPerKey * n
    this._bitBuffer.resizeBits(bits)
    bits = this._bitBuffer.bits
    // console.log('putKeys bits', bits)

    for (let i = 0; i < n; i++) {
      let h = BloomHash(keys[i])
      let delta = (h >> 17) | (h << 15)
      for (let j = 0; j < this.kNumber; j++) {
        const bitPosition = h % bits
        // console.log(`putkeys bitPosition`, bitPosition)
        this._bitBuffer.set(bitPosition, true)
        h += delta
      }
    }
    this._buffer = Buffer.concat([
      this._bitBuffer.buffer,
      this._buffer.slice(
        this._offset + this._size - 1,
        this._offset + this._size
      ),
    ])
    this._size = this._buffer.length
  }

  keyMayMatch(key: Slice): boolean {
    // console.log('this._bitBuffer.bits', this._bitBuffer.bits)
    if (this.kNumber > 30) return true
    let h = BloomHash(key.toString())
    // console.log('h', h)
    let delta = (h >> 17) | (h << 15)
    for (let j = 0; j < this.kNumber; j++) {
      const bitPosition = h % this._bitBuffer.bits
      // console.log(`bitPosition`, bitPosition)
      if (!this._bitBuffer.get(bitPosition)) return false
      h += delta
    }
    return true
  }
}
