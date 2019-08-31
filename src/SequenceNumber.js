/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow

import varint from 'varint'
export default class SequenceNumber {
  constructor (initial:number = 0) {
    this._value = initial
  }

  _value: number

  get value ():number {
    this._value++
    return this._value
  }

  toBuffer ():Buffer {
    return Buffer.from(varint.encode(this._value))
  }

  toFixedSizeBuffer (size:number = 7):Buffer {
    let buf = this.toBuffer()
    return Buffer.concat([
      buf,
      Buffer.alloc(size - buf.length)
    ])
  }
}
