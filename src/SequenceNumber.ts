/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import varint from 'varint'
import assert from 'assert'
import { decodeFixed64, encodeFixed64 } from './Coding'

export default class SequenceNumber {
  constructor(initial: number = 0) {
    this._value = initial
  }

  private _value: number

  get value(): number {
    return this._value
  }

  set value(value) {
    this._value = value
  }

  toBuffer(): Buffer {
    return Buffer.from(varint.encode(this._value))
  }

  toFixed64Buffer(): Buffer {
    return encodeFixed64(this._value)
  }
}
