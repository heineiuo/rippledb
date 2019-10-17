/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import crc32 from 'buffer-crc32'
import varint from 'varint'
import { Buffer } from 'buffer'
import Slice from './Slice'
import { ValueType } from './Format'
import {
  RecordType,
  createHexStringFromDecimal,
  kHeaderSize,
} from './LogFormat'

export default class LogRecord {
  static add(key: Slice, value: Slice): Slice {
    return new Slice(
      Buffer.concat([
        Buffer.from([ValueType.kTypeValue]),
        Buffer.from(varint.encode(key.length)),
        key.buffer,
        Buffer.from(varint.encode(value.length)),
        value.buffer,
      ])
    )
  }

  static del(key: Slice): Slice {
    return new Slice(
      Buffer.concat([
        Buffer.from([ValueType.kTypeDeletion]),
        Buffer.from(varint.encode(key.length)),
        key.buffer,
      ])
    )
  }

  static decode(op: Slice): { type: ValueType; key: Slice; value?: Slice } {
    const valueType = op.buffer.readUInt8(0)
    let index = 1
    const keyLength = varint.decode(op.buffer.slice(1))
    index += varint.decode.bytes
    const keyBuffer = op.buffer.slice(index, index + keyLength)
    index += keyLength

    if (valueType === ValueType.kTypeDeletion) {
      return {
        type: valueType,
        key: new Slice(keyBuffer),
      }
    }

    const valueLength = varint.decode(op.buffer.slice(index))
    index += varint.decode.bytes
    const valueBuffer = op.buffer.slice(index, index + valueLength)
    return {
      type: valueType,
      key: new Slice(keyBuffer),
      value: new Slice(valueBuffer),
    }
  }

  constructor(recordType: RecordType, data: Slice | Buffer) {
    this.recordType = recordType
    this.data = new Slice(data)
  }

  get length() {
    return this.data.length + kHeaderSize
  }

  get size() {
    return this.length
  }

  data: Slice
  recordType: RecordType

  get buffer(): Buffer {
    const lengthBuf = Buffer.from(
      createHexStringFromDecimal(this.data.length),
      'hex'
    )
    const typeBuf = Buffer.from([this.recordType])
    const sum = crc32(Buffer.concat([typeBuf, this.data.buffer]))
    return Buffer.concat([sum, lengthBuf, typeBuf, this.data.buffer])
  }
}
