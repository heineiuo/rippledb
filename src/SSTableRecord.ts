/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow

import varint from 'varint'
import { Buffer } from 'buffer'
import { Options } from './Options'
import Slice from './Slice'

function getSize(buffer: Buffer, offset: number = 0): number {
  if (buffer.length === 0) return 0
  const buf = buffer.slice(offset)
  const keyLength = varint.decode(buf)
  const keyStartIndex = varint.decode.bytes
  const valueLength = varint.decode(buf, keyStartIndex + keyLength)
  const valueStartIndex = keyStartIndex + keyLength + varint.decode.bytes
  return valueStartIndex + valueLength
}

export default class SSTableRecord {
  constructor(buffer: Buffer, offset?: number, size?: number) {
    this._buffer = buffer || Buffer.from([])
    this._offset = offset || 0
    this._size = size || getSize(this._buffer, this._offset)
  }

  _buffer: Buffer
  _offset: number
  _size: number

  get size(): number {
    return this._size
  }

  get buffer(): Buffer {
    return this._buffer
  }

  get offset(): number {
    return this._offset
  }

  get(
    options: Options = {}
  ): { key: null | string | Buffer; value: null | string | Buffer } {
    if (this.size === 0) return { key: null, value: null }
    const keyLength = varint.decode(this.buffer, this.offset)
    const keyStartIndex = varint.decode.bytes
    const key = this.buffer.slice(
      this.offset + keyStartIndex,
      this.offset + keyStartIndex + keyLength
    )
    const valueLength = varint.decode(
      this.buffer,
      this.offset + keyStartIndex + keyLength
    )
    const valueStartIndex = keyStartIndex + keyLength + varint.decode.bytes
    const value = this.buffer.slice(
      this.offset + valueStartIndex,
      this.offset + valueStartIndex + valueLength
    )

    const keyEncoding = options.keyEncoding || 'string'
    const valueEncoding = options.valueEncoding || 'string'

    return {
      key: keyEncoding === 'string' ? String(key) : key,
      value: valueEncoding === 'string' ? String(value) : value,
    }
  }

  /**
   * [key_length, key, value_length, value]
   */
  put(key: Slice, value: Slice): void {
    if (key && value) {
      const keyLength = varint.encode(key.length)
      const valueLength = varint.encode(value.length)
      this._buffer = Buffer.concat([
        Buffer.from(keyLength),
        Buffer.from(key.buffer),
        Buffer.from(valueLength),
        Buffer.from(value.buffer),
      ])
      this._offset = 0
      this._size = this._buffer.length
    }
  }
}
