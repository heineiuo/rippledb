/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

import crc32 from 'buffer-crc32'
import assert from 'assert'
import Slice from './Slice'
import { RecordType, ValueType } from './Format'
import { createHexStringFromDecimal } from './LevelUtils'

export default class LogRecord {
  static from (buf:Buffer) {
    const length = buf.readUInt16BE(4)
    const type = RecordType.get(buf.readUInt8(6))
    const data = new Slice(buf.slice(7))
    assert(length === data.length)
    const record = new LogRecord(type, data)
    return record
  }

  constructor (type:RecordType, data:Slice | Buffer) {
    this.type = type
    this.data = new Slice(data)
  }

  get length () {
    return this.data.length + 7
  }

  get size () {
    return this.length
  }

  data:Slice
  type:ValueType

  get buffer ():Buffer {
    const lengthBuf = Buffer.from(createHexStringFromDecimal(this.data.length), 'hex')
    const typeBuf = Buffer.from([this.type.value])
    const sum = crc32(Buffer.concat([typeBuf, this.data.buffer]))
    return Buffer.concat([
      sum,
      lengthBuf,
      typeBuf,
      this.data.buffer
    ])
  }
}
