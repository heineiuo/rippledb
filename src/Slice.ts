/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class Slice {
  constructor(value: unknown = Buffer.alloc(0)) {
    if (value instanceof Slice) {
      this._buffer = value._buffer
    } else if (Buffer.isBuffer(value)) {
      this._buffer = value
    } else if (typeof value === 'string') {
      this._buffer = Buffer.from(value)
    } else {
      this._buffer = Buffer.from(JSON.stringify(value))
    }
  }

  private _buffer: Buffer

  get buffer(): Buffer {
    return this._buffer
  }

  set buffer(buf: Buffer) {
    this._buffer = buf
  }

  get length(): number {
    return this._buffer.length
  }

  get size(): number {
    return this._buffer.length
  }

  toString(encoding?: BufferEncoding): string {
    return this._buffer.toString(encoding)
  }

  clear(): void {
    this._buffer = Buffer.alloc(0)
  }

  compare(slice: Slice): number {
    return this._buffer.compare(slice.buffer)
  }

  isEqual(slice: Slice): boolean {
    return this.compare(slice) === 0
  }
}
