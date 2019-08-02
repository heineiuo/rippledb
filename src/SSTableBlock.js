/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import crc32 from 'buffer-crc32'
import Enum from 'enum'
import varint from 'varint'
import { Buffer } from 'buffer'
import SSTableRecord from './SSTableRecord'

const CompressionTypes = new Enum({
  'none': 0
})

export default class SSTableBlock {
  constructor (buffer = Buffer.from([]), offset, size) {
    this._buffer = buffer
    this._offset = offset || 0
    this._size = size || (this._buffer.length - this._offset)
  }

  get buffer ():Buffer {
    return this._buffer
  }

  get size ():number {
    return this._size
  }

  get offset ():number {
    return this._offset
  }

  get crc32 ():Buffer {
    return this._buffer.slice(this.offset + this._size - 4)
  }

  get compressionType ():number {
    return this._buffer.slice(this.offset + this._size - 5, this.offset + this._size - 4)
  }

  get estimateSize ():number {

  }

  * iterator (encoding:"utf8"|"buffer") {
    let recordSizeSummary:number = 0
    while (true) {
      if (recordSizeSummary >= this.size - 5) {
        // console.log('SSTableBlock iterator done because offset is: ' + offset + ' and size is ' + this._size + ' and record.size is ' + record.size + ' and data is ' + JSON.stringify(data))
        return
      }
      const record = new SSTableRecord(this.buffer, this.offset + recordSizeSummary)
      const data = record.get(encoding)
      yield data
      // console.log('SSTableBlock iterator increase with offset ' + offset + ' and fixed-size ' + this._size + ' and record.size is ' + record.size)
      recordSizeSummary += record.size
    }
  }

  append (data:{key:any, value:any}):void {
    const record = new SSTableRecord()
    record.put(data.key, data.value)
    let body
    if (this._buffer && this._size > 5) {
      body = Buffer.concat([
        this._buffer.slice(0, this._size - 5),
        record.buffer
      ])
    } else {
      body = record.buffer
    }

    const compressionType = Buffer.from(varint.encode(CompressionTypes.get('none').value))
    const crc32buffer = crc32(body)
    this._buffer = Buffer.concat([
      body,
      compressionType,
      crc32buffer
    ])
    this._offset = 0
    this._size = this._buffer.length
  }
}
