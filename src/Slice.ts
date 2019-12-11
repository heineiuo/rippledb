/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class Slice {
  static compare(a: Slice, b: Slice): 0 | -1 | 1 {
    if (a === b) return 0

    let x = a.length
    let y = b.length

    for (let i = 0, len = Math.min(x, y); i < len; ++i) {
      if (a.srcBuffer[i + a.offset] !== b.srcBuffer[i + b.offset]) {
        x = a.srcBuffer[i + a.offset]
        y = b.srcBuffer[i + b.offset]
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  }

  constructor(value: unknown = Buffer.alloc(0), offset = 0) {
    if (value instanceof Slice) {
      this._buffer = value._buffer
    } else if (Buffer.isBuffer(value)) {
      this._buffer = value
    } else if (typeof value === 'string') {
      this._buffer = Buffer.from(value)
    } else {
      this._buffer = Buffer.from(JSON.stringify(value))
    }
    this._offset = offset
  }

  private _buffer: Buffer
  private _offset: number

  get offset(): number {
    return this._offset
  }

  get buffer(): Buffer {
    if (this.offset > 0) {
      this._buffer = this._buffer.slice(this.offset)
      this._offset = 0
    }
    return this._buffer
  }

  set buffer(buf: Buffer) {
    this._buffer = buf
  }

  get srcBuffer(): Buffer {
    return this._buffer
  }

  get length(): number {
    return this._buffer.length - this.offset
  }

  get size(): number {
    return this._buffer.length - this.offset
  }

  toString(encoding?: BufferEncoding): string {
    return this.buffer.toString(encoding)
  }

  clear(): void {
    this._buffer = Buffer.alloc(0)
    this._offset = 0
  }

  compare(slice: Slice): number {
    return Slice.compare(this, slice)
    // return Buffer.compare(this.buffer, slice.buffer)
  }

  isEqual(slice: Slice): boolean {
    return this.compare(slice) === 0
  }
}
