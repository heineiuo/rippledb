/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import varint from 'varint'
import { Buffer } from 'buffer'
import Slice from './Slice'
import { Entry } from './VersionFormat'

// Record format: [key_length, key, value_length, value]
export default class SSTableRecord {
  static getSize(buffer: Buffer, offset: number = 0): number {
    if (buffer.length === 0) return 0
    const buf = buffer.slice(offset)
    const keyLength = varint.decode(buf)
    const keyStartIndex = varint.decode.bytes
    const valueLength = varint.decode(buf, keyStartIndex + keyLength)
    const valueStartIndex = keyStartIndex + keyLength + varint.decode.bytes
    return valueStartIndex + valueLength
  }

  constructor(buffer: Buffer) {
    const size = SSTableRecord.getSize(buffer)
    this._buffer = buffer.slice(0, size)
  }

  _buffer: Buffer

  get size(): number {
    return this._buffer.length
  }

  get buffer(): Buffer {
    return this._buffer
  }

  isEmpty(): boolean {
    return this.size === 0
  }

  get(): Entry {
    const keyLength = varint.decode(this.buffer)
    const keyStartIndex = varint.decode.bytes
    const key = this.buffer.slice(keyStartIndex, keyStartIndex + keyLength)
    const valueLength = varint.decode(this.buffer, keyStartIndex + keyLength)
    const valueStartIndex = keyStartIndex + keyLength + varint.decode.bytes
    const value = this.buffer.slice(
      valueStartIndex,
      valueStartIndex + valueLength
    )

    return {
      key: new Slice(key),
      value: new Slice(value),
    } as Entry
  }

  put(key: Slice, value: Slice): void {
    const keyLength = varint.encode(key.length)
    const valueLength = varint.encode(value.length)
    this._buffer = Buffer.concat([
      Buffer.from(keyLength),
      Buffer.from(key.buffer),
      Buffer.from(valueLength),
      Buffer.from(value.buffer),
    ])
  }
}
