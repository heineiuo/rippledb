/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import varint from 'varint'
import { Buffer } from 'buffer'
import BloomFilter from './BloomFilter'

/**
 * The "metaindex" block contains an entry that maps from filter.<N>
 * to the BlockHandle for the filter block where <N> is the string
 * returned by the filter policy's Name() method.
 *
 * [filter 0]
 * [filter 1]
 * [filter 2]
 * ...
 * [filter N-1]
 * [offset of filter 0] : 4 bytes
 * [offset of filter 1] : 4 bytes
 * [offset of filter 2] : 4 bytes
 * ...
 * [offset of filter N-1] : 4 bytes
 * [offset of beginning of offset array] : 4 bytes
 * lg(base) : 1 byte
 */
export default class SSTableMetaBlock {
  constructor (buffer:Buffer, offset?:number, size?:number) {
    this._buffer = buffer || Buffer.from([])
    this._offset = offset || 0
    this._size = size || 0
  }

  get buffer ():Buffer {
    return this._buffer
  }

  get beginningOfOffset ():number {
    let buf
    if (this._offset === 0 && this._size === this._buffer.length) {
      buf = this._buffer
    } else {
      buf = this._buffer.slice(this._offset, this._size)
    }
    return varint.decode(buf, buf.length - 2)
  }

  get baseLg ():number {
    return 11
  }

  appendFilter (buffer:Buffer) {
    // console.log('appendFilter buffer: ', buffer)
    // console.log('appendFilter buffer length: ', buffer.length)

    let buf
    if (this._offset === 0 && this._size === this._buffer.length) {
      buf = this._buffer
    } else {
      buf = this._buffer.slice(this._offset, this._size)
    }

    let filterBuffers = buf.slice(0, this.beginningOfOffset)
    filterBuffers = Buffer.concat([filterBuffers, buffer])
    // console.log('filterBuffers length: ', filterBuffers.length)
    let filterOffsetBuffers = buf.slice(this.beginningOfOffset, buf.length - 2)
    filterOffsetBuffers = Buffer.concat([
      filterOffsetBuffers,
      Buffer.from(varint.encode(filterBuffers.length))
    ])
    // console.log('filterOffsetBuffers length: ', filterOffsetBuffers.length)

    this._buffer = Buffer.concat([
      filterBuffers,
      filterOffsetBuffers,
      Buffer.from(varint.encode(filterBuffers.length)),
      Buffer.from(varint.encode(this.baseLg))
    ])
    this._offset = 0
    this._size = this._buffer.length
  }

  * iterator () {
    const offsetIterator = this.offsetIterator()
    let offsetResult = offsetIterator.next()
    let filterStart = this._offset
    let filterEnd = 0
    while (!offsetResult.done) {
      filterEnd = offsetResult.value
      // console.log('offsetResult.value', offsetResult.value)
      // console.log(this.buffer.slice(filterStart, filterEnd))
      const filter = new BloomFilter(this.buffer.slice(filterStart, filterEnd))
      yield filter
      filterStart += offsetResult.result
      offsetResult = offsetIterator.next()
    }
  }

  * offsetIterator () {
    const start = this.beginningOfOffset
    const offsetTotalCount = this._size - 2 - start
    // console.log('this._size: ', this._size)
    // console.log('beginningOfOffset: ', start)
    // console.log('offsetTotalCount: ', offsetTotalCount)
    let count = 0
    while (count < offsetTotalCount) {
      const offset = varint.decode(this._buffer.slice(start + count))
      // console.log('offsetIterator yield offset: ', offset)
      yield offset
      count += 1
    }
  }
}
